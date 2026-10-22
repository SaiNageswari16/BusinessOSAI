import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar, ChevronDown, FileDown, Plus, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { OrderDetailsPanel } from "@/components/orders/OrderDetailsPanel";
import { type DateRangePreset, OrdersFilterBar } from "@/components/orders/OrdersFilterBar";
import { OrdersKpiStrip } from "@/components/orders/OrdersKpiStrip";
import { OrdersTableList } from "@/components/orders/OrdersTableList";
import {
  computeOrdersKpiSummary,
  type DisplayKitchenStatus,
  type DisplayOrderStatus,
  deriveDisplayOrderStatus,
  deriveKitchenStatus,
  exportOrdersToCsv,
} from "@/components/orders/orders-utils";
import { DiscountModal, KotPreviewModal } from "@/components/pos/PosModals";
import { ReceiptModal } from "@/components/shared/ReceiptModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orderTotal, totals } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Kot, Order, OrderType, PaymentStatus } from "@/lib/types";

export const Route = createFileRoute("/orders")({
  component: OrdersScreen,
});

const DATE_RANGE_LABELS: Record<DateRangePreset, { title: string; sub: string }> = {
  all: { title: "Today, 17 Aug 2025", sub: "12:00 AM - 11:59 PM" },
  today: { title: "Today (Live Shift)", sub: "12:00 AM - 11:59 PM" },
  yesterday: { title: "Yesterday's Ledger", sub: "12:00 AM - 11:59 PM" },
  "7days": { title: "Last 7 Days", sub: "Rolling 7-Day Window" },
};

export function OrdersScreen() {
  const navigate = useNavigate();

  const orders = useRestaurantStore((s) => s.orders);
  const kots = useRestaurantStore((s) => s.kots);
  const customers = useRestaurantStore((s) => s.customers);
  const tables = useRestaurantStore((s) => s.tables);
  const settings = useRestaurantStore((s) => s.settings);

  const openPosForOrder = useRestaurantStore((s) => s.openPosForOrder);
  const clearPosCart = useRestaurantStore((s) => s.clearPosCart);
  const requestBill = useRestaurantStore((s) => s.requestBill);
  const completePayment = useRestaurantStore((s) => s.completePayment);
  const cancelOrder = useRestaurantStore((s) => s.cancelOrder);
  const markOrderServed = useRestaurantStore((s) => s.markOrderServed);
  const advanceKot = useRestaurantStore((s) => s.advanceKot);
  const updateOrderDiscount = useRestaurantStore((s) => s.updateOrderDiscount);
  const updateOrderNote = useRestaurantStore((s) => s.updateOrderNote);
  const sendOrderToKitchen = useRestaurantStore((s) => s.sendOrderToKitchen);
  const holdExistingOrder = useRestaurantStore((s) => s.holdExistingOrder);

  // Filters & View State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | OrderType>("all");
  const [statusGroup, setStatusGroup] = useState<"all" | "pending" | "completed" | "cancelled">(
    "all",
  );
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | DisplayOrderStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatus>("all");
  const [kitchenStatusFilter, setKitchenStatusFilter] = useState<"all" | DisplayKitchenStatus>(
    "all",
  );
  const [dateRange, setDateRange] = useState<DateRangePreset>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortBy, setSortBy] = useState<"newest" | "amount-desc" | "oldest">("newest");

  // Selection & Modals
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>("ORD-1045");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [discountTarget, setDiscountTarget] = useState<Order | null>(null);
  const [kotPreview, setKotPreview] = useState<{
    orderId: string;
    tableLabel: string;
    kots: Kot[];
    note: string;
  } | null>(null);

  const kpiSummary = useMemo(() => computeOrdersKpiSummary(orders), [orders]);

  const filteredOrders = useMemo(() => {
    const now = Date.now();
    const list = orders.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false;

      if (statusGroup === "pending") {
        if (o.status === "completed" || o.status === "cancelled") return false;
      } else if (statusGroup === "completed") {
        if (o.status !== "completed") return false;
      } else if (statusGroup === "cancelled") {
        if (o.status !== "cancelled") return false;
      }

      if (orderStatusFilter !== "all") {
        if (deriveDisplayOrderStatus(o) !== orderStatusFilter) return false;
      }

      if (paymentFilter !== "all" && o.payment !== paymentFilter) return false;

      if (kitchenStatusFilter !== "all") {
        if (deriveKitchenStatus(o, kots) !== kitchenStatusFilter) return false;
      }

      if (dateRange === "today") {
        if (now - o.createdAt > 24 * 3600000) return false;
      } else if (dateRange === "yesterday") {
        const ageHours = (now - o.createdAt) / 3600000;
        if (ageHours < 18 || ageHours > 60) return false;
      } else if (dateRange === "7days") {
        if (now - o.createdAt > 7 * 24 * 3600000) return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase().replace(/^#/, "");
        const cust = customers.find((c) => c.id === o.customerId);
        const matchesItems = o.lines.some((l) => l.name.toLowerCase().includes(q));
        return (
          o.id.toLowerCase().includes(q) ||
          (o.tableId?.toLowerCase().includes(q) ?? false) ||
          (cust?.name.toLowerCase().includes(q) ?? false) ||
          (cust?.phone.toLowerCase().includes(q) ?? false) ||
          matchesItems
        );
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "newest") return b.createdAt - a.createdAt;
      if (sortBy === "oldest") return a.createdAt - b.createdAt;
      return orderTotal(b, settings.gstPct) - orderTotal(a, settings.gstPct);
    });

    return list;
  }, [
    orders,
    kots,
    customers,
    typeFilter,
    statusGroup,
    orderStatusFilter,
    paymentFilter,
    kitchenStatusFilter,
    dateRange,
    search,
    sortBy,
    settings.gstPct,
  ]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return undefined;
    return (
      filteredOrders.find((o) => o.id === selectedOrderId) ??
      orders.find((o) => o.id === selectedOrderId) ??
      filteredOrders[0]
    );
  }, [filteredOrders, orders, selectedOrderId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedOrder?.customerId),
    [customers, selectedOrder],
  );

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedOrder?.tableId),
    [tables, selectedOrder],
  );

  const selectedKots = useMemo(
    () => (selectedOrder ? kots.filter((k) => k.orderId === selectedOrder.id) : []),
    [kots, selectedOrder],
  );

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusGroup("all");
    setOrderStatusFilter("all");
    setPaymentFilter("all");
    setKitchenStatusFilter("all");
    setDateRange("all");
  };

  const handleExportCsv = () => {
    const csv = exportOrdersToCsv(filteredOrders, customers, settings.gstPct);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `restaurantos-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredOrders.length} orders to CSV`);
  };

  const handleSendToKitchen = (orderId: string) => {
    const res = sendOrderToKitchen(orderId);
    if (!res.ok) {
      toast.error(res.error ?? "Could not send order to kitchen");
      return;
    }
    toast.success(`Dispatched ${orderId} to Kitchen Display (KDS)`);
  };

  const handlePrintKot = (order: Order) => {
    const res = sendOrderToKitchen(order.id);
    if (!res.ok) {
      toast.error(res.error ?? "Unable to prepare KOT slip");
      return;
    }
    const latestKots = useRestaurantStore.getState().kots.filter((k) => k.orderId === order.id);
    setKotPreview({
      orderId: order.id,
      tableLabel: order.tableId ? `Table ${order.tableId}` : order.type.toUpperCase(),
      kots: latestKots,
      note: order.note ?? "",
    });
  };

  const handleGenerateBill = (order: Order) => {
    requestBill(order.id);
    const refreshed = useRestaurantStore.getState().orders.find((o) => o.id === order.id) ?? order;
    setReceiptOrder(refreshed);
    toast.success(`Generated bill for ${order.id}`);
  };

  const handleHoldOrder = (orderId: string) => {
    const res = holdExistingOrder(orderId);
    if (!res.ok) {
      toast.error(res.error ?? "Unable to hold order");
      return;
    }
    toast.info(`Order ${orderId} parked in POS Hold Orders (${res.heldId})`);
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    const res = cancelOrder(cancelTarget.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Order ${cancelTarget.id} has been cancelled`);
    setCancelTarget(null);
  };

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-108px)] bg-[#F4F7FC] px-4 py-4 sm:-mx-6 sm:px-6">
      <div className="mx-auto max-w-[1600px] space-y-3.5">
        {/* 1. Page Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-tight text-[#102344]">Orders</h1>
            <p className="mt-0.5 text-[12.5px] font-medium text-[#64748B]">
              View, manage and track all restaurant orders in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2.5 rounded-xl border border-[#E1E9F4] bg-white px-3.5 text-left shadow-2xs transition-colors hover:bg-slate-50"
                >
                  <Calendar className="h-4 w-4 text-[#334155]" />
                  <div className="leading-tight">
                    <div className="text-[11.5px] font-bold text-[#102344]">
                      {DATE_RANGE_LABELS[dateRange].title}
                    </div>
                    <div className="text-[10px] font-medium text-[#64748B] tabular">
                      {DATE_RANGE_LABELS[dateRange].sub}
                    </div>
                  </div>
                  <ChevronDown className="ml-1 h-3.5 w-3.5 text-[#64748B]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                {(["all", "today", "yesterday", "7days"] as const).map((preset) => (
                  <DropdownMenuItem key={preset} onClick={() => setDateRange(preset)}>
                    <div>
                      <div className="font-bold text-[#102344]">
                        {DATE_RANGE_LABELS[preset].title}
                      </div>
                      <div className="text-[10px] text-[#64748B]">
                        {DATE_RANGE_LABELS[preset].sub}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E1E9F4] bg-white px-3.5 text-[12px] font-bold text-[#102344] shadow-2xs transition-colors hover:bg-slate-50"
                >
                  <FileDown className="h-4 w-4 text-[#334155]" />
                  <span>Export</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuItem onClick={handleExportCsv}>
                  <FileDown className="mr-2 h-3.5 w-3.5" />
                  Export CSV ({filteredOrders.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()}>
                  <Printer className="mr-2 h-3.5 w-3.5" />
                  Print Orders Ledger
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Primary New Order Button */}
            <button
              type="button"
              onClick={() => {
                clearPosCart();
                navigate({ to: "/pos" });
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0866F5] px-4 text-[12.5px] font-bold text-white shadow-sm transition-colors hover:bg-[#0756D0]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>New Order</span>
            </button>
          </div>
        </div>

        {/* 2. Main Split Workspace: Left (KPI Strip + Filter Bar + Table) & Right (Order Details Panel) */}
        <div className="flex flex-col items-start gap-3.5 xl:flex-row">
          {/* Left Workspace */}
          <div className="min-w-0 flex-1 space-y-3 w-full">
            <OrdersKpiStrip
              summary={kpiSummary}
              activeTypeFilter={typeFilter}
              activeStatusGroup={statusGroup}
              onSelectTypeFilter={(t) => setTypeFilter(t)}
              onSelectStatusGroup={(g) => setStatusGroup(g)}
              onResetAll={handleResetFilters}
            />

            <OrdersFilterBar
              search={search}
              typeFilter={typeFilter}
              orderStatusFilter={orderStatusFilter}
              paymentFilter={paymentFilter}
              kitchenStatusFilter={kitchenStatusFilter}
              dateRange={dateRange}
              viewMode={viewMode}
              onChangeSearch={setSearch}
              onChangeTypeFilter={setTypeFilter}
              onChangeOrderStatusFilter={setOrderStatusFilter}
              onChangePaymentFilter={setPaymentFilter}
              onChangeKitchenStatusFilter={setKitchenStatusFilter}
              onChangeDateRange={setDateRange}
              onChangeViewMode={setViewMode}
              onReset={handleResetFilters}
            />

            <OrdersTableList
              orders={filteredOrders}
              kots={kots}
              customers={customers}
              gstPct={settings.gstPct}
              selectedOrderId={selectedOrder?.id}
              viewMode={viewMode}
              sortBy={sortBy}
              onToggleAmountSort={() =>
                setSortBy((prev) => (prev === "amount-desc" ? "newest" : "amount-desc"))
              }
              onSelectOrder={(id) => setSelectedOrderId(id)}
              onPrintOrder={(ord) => setReceiptOrder(ord)}
              onOpenInPos={(id) => {
                openPosForOrder(id);
                navigate({ to: "/pos" });
              }}
              onSendToKitchen={handleSendToKitchen}
              onSettlePayment={(ord) => {
                const res = completePayment(ord.id, "UPI");
                if (res.ok) {
                  toast.success(`Settled payment for ${ord.id}`);
                  const updated = useRestaurantStore.getState().orders.find((o) => o.id === ord.id);
                  if (updated) setReceiptOrder(updated);
                } else {
                  toast.error(res.error ?? "Could not settle payment");
                }
              }}
              onHoldOrder={handleHoldOrder}
              onRequestCancel={(ord) => setCancelTarget(ord)}
            />
          </div>

          {/* Right Order Details Panel */}
          <OrderDetailsPanel
            order={selectedOrder}
            customer={selectedCustomer}
            table={selectedTable}
            kots={selectedKots}
            gstPct={settings.gstPct}
            onClose={() => setSelectedOrderId(undefined)}
            onAddItemsInPos={(id) => {
              openPosForOrder(id);
              navigate({ to: "/pos" });
            }}
            onUpdateNote={(orderId, note) => updateOrderNote(orderId, note)}
            onOpenDiscountModal={(ord) => setDiscountTarget(ord)}
            onSendToKitchen={handleSendToKitchen}
            onGenerateBill={handleGenerateBill}
            onHoldOrder={handleHoldOrder}
            onPrintKot={handlePrintKot}
            onPrintReceipt={(ord) => setReceiptOrder(ord)}
            onAdvanceKot={(kotId) => {
              advanceKot(kotId);
              toast.success(`Advanced ${kotId}`);
            }}
            onMarkServed={(orderId) => {
              markOrderServed(orderId);
              toast.success(`Marked ${orderId} as Served`);
            }}
            onSettlePaymentQuick={(orderId, method) => {
              const res = completePayment(orderId, method);
              if (res.ok) {
                toast.success(`Paid ${orderId} via ${method}`);
                const updated = useRestaurantStore.getState().orders.find((o) => o.id === orderId);
                if (updated) setReceiptOrder(updated);
              } else {
                toast.error(res.error ?? "Payment failed");
              }
            }}
            onCancelOrder={(ord) => setCancelTarget(ord)}
          />
        </div>
      </div>

      {/* Discount Modal for Selected Order */}
      {discountTarget && (
        <DiscountModal
          open={discountTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDiscountTarget(null);
          }}
          currentDiscountPct={discountTarget.discountPct}
          maxDiscountPct={settings.maxDiscountPct}
          subtotal={totals(discountTarget.lines, 0, settings.gstPct).subtotal}
          onApplyDiscount={(pct) => {
            const res = updateOrderDiscount(discountTarget.id, pct);
            return res.ok;
          }}
        />
      )}

      {/* KOT Print Preview Modal */}
      {kotPreview && (
        <KotPreviewModal
          open={kotPreview !== null}
          onOpenChange={(open) => {
            if (!open) setKotPreview(null);
          }}
          orderId={kotPreview.orderId}
          tableLabel={kotPreview.tableLabel}
          kots={kotPreview.kots}
          note={kotPreview.note}
          onNavigateKitchen={() => navigate({ to: "/kot" })}
        />
      )}

      {/* Cancel Order Confirmation Modal */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order #{cancelTarget?.id}?</DialogTitle>
            <DialogDescription>
              Cancelling this order will remove its active kitchen tickets and release any occupied
              table. Completed orders cannot be cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Keep Order
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmCancel}>
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt / Bill Modal */}
      <ReceiptModal
        order={receiptOrder}
        open={receiptOrder !== null}
        onOpenChange={(open) => {
          if (!open) setReceiptOrder(null);
        }}
      />
    </div>
  );
}
