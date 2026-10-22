import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  ListFilter,
  Map as MapIcon,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FloorFilterSidebar } from "@/components/operations/FloorFilterSidebar";
import { FloorPlanCanvas } from "@/components/operations/FloorPlanCanvas";
import { type CapacityFilter, TABLE_STATUS_CONFIG } from "@/components/operations/operations-utils";
import { TableDetailsPanel } from "@/components/operations/TableDetailsPanel";
import { TableSummaryCards } from "@/components/operations/TableSummaryCards";
import { ReceiptModal } from "@/components/shared/ReceiptModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, lineTotal, minutesSince, orderTotal, totals } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Area, DiningTable, Order, TableStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operations")({
  component: OperationsScreen,
});

const INITIAL_STATUS_FILTERS: Record<TableStatus, boolean> = {
  available: true,
  occupied: true,
  reserved: true,
  billing: true,
  cleaning: true,
};

const SERVICE_SLOTS = [
  { id: "lunch", dateLabel: "Sun, 17 Aug 2025", timeLabel: "12:45 PM", shift: "Lunch Peak" },
  { id: "evening", dateLabel: "Sun, 17 Aug 2025", timeLabel: "07:30 PM", shift: "Dinner Service" },
  { id: "late", dateLabel: "Sun, 17 Aug 2025", timeLabel: "10:15 PM", shift: "Late Dining" },
] as const;

export function OperationsScreen() {
  const navigate = useNavigate();

  const tables = useRestaurantStore((s) => s.tables);
  const orders = useRestaurantStore((s) => s.orders);
  const kots = useRestaurantStore((s) => s.kots);
  const customers = useRestaurantStore((s) => s.customers);
  const menu = useRestaurantStore((s) => s.menu);
  const reservations = useRestaurantStore((s) => s.reservations);
  const staff = useRestaurantStore((s) => s.staff);
  const settings = useRestaurantStore((s) => s.settings);

  const openPosForTable = useRestaurantStore((s) => s.openPosForTable);
  const setTableStatus = useRestaurantStore((s) => s.setTableStatus);
  const transferTable = useRestaurantStore((s) => s.transferTable);
  const mergeTables = useRestaurantStore((s) => s.mergeTables);
  const splitTableBill = useRestaurantStore((s) => s.splitTableBill);
  const requestBill = useRestaurantStore((s) => s.requestBill);
  const completePayment = useRestaurantStore((s) => s.completePayment);
  const markOrderServed = useRestaurantStore((s) => s.markOrderServed);
  const cancelOrder = useRestaurantStore((s) => s.cancelOrder);
  const updateReservationStatus = useRestaurantStore((s) => s.updateReservationStatus);
  const saveTablesLayout = useRestaurantStore((s) => s.saveTablesLayout);
  const deleteDiningTable = useRestaurantStore((s) => s.deleteDiningTable);

  // View & Filter State
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<"All" | Area>("All");
  const [activeFloorArea, setActiveFloorArea] = useState<Area>("Main Hall");
  const [activeStatuses, setActiveStatuses] =
    useState<Record<TableStatus, boolean>>(INITIAL_STATUS_FILTERS);
  const [capacityFilter, setCapacityFilter] = useState<CapacityFilter>("all");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [serviceSlot, setServiceSlot] = useState<(typeof SERVICE_SLOTS)[number]>(SERVICE_SLOTS[0]);
  const [isEditingLayout, setIsEditingLayout] = useState(false);

  // Default selected table: pick the first billing or occupied table in Main Hall so the details panel shows an active order right away
  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    const billingMain = tables.find((t) => t.area === "Main Hall" && t.status === "billing");
    if (billingMain) return billingMain.id;
    const occupiedMain = tables.find((t) => t.area === "Main Hall" && t.status === "occupied");
    if (occupiedMain) return occupiedMain.id;
    return tables[0]?.id ?? "T1";
  });

  // Modals state
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Card" | "Cash">("UPI");
  const [billingDiscountPct, setBillingDiscountPct] = useState<number>(0);
  const [moveToCleaningAfterPay, setMoveToCleaningAfterPay] = useState<boolean>(true);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>("");
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitLineIds, setSplitLineIds] = useState<string[]>([]);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Area selection handlers keeping Left Panel and Center Canvas Tabs coordinated
  const handleSelectSidebarArea = (area: "All" | Area) => {
    setSelectedAreaFilter(area);
    if (area !== "All") {
      setActiveFloorArea(area);
    }
  };

  const handleSelectCanvasFloorArea = (area: Area) => {
    setActiveFloorArea(area);
    if (selectedAreaFilter !== "All") {
      setSelectedAreaFilter(area);
    }
    // Select first table in that area if current selectedTable is in another area
    const currentTbl = tables.find((t) => t.id === selectedTableId);
    if (currentTbl && currentTbl.area !== area) {
      const firstInArea =
        tables.find(
          (t) => t.area === area && (t.status === "billing" || t.status === "occupied"),
        ) ?? tables.find((t) => t.area === area);
      if (firstInArea) {
        setSelectedTableId(firstInArea.id);
      }
    }
  };

  const handleToggleStatusSwitch = (status: TableStatus) => {
    setActiveStatuses((prev) => {
      const next = { ...prev, [status]: !prev[status] };
      // Prevent turning every single status off simultaneously
      if (Object.values(next).every((v) => !v)) {
        return INITIAL_STATUS_FILTERS;
      }
      return next;
    });
  };

  const handleSelectStatusCard = (status: TableStatus | "all") => {
    if (status === "all") {
      setActiveStatuses(INITIAL_STATUS_FILTERS);
      return;
    }
    setActiveStatuses((prev) => {
      const isCurrentlySolo =
        prev[status] &&
        Object.entries(prev)
          .filter(([k]) => k !== status)
          .every(([, v]) => !v);
      if (isCurrentlySolo) {
        return INITIAL_STATUS_FILTERS;
      }
      return {
        available: status === "available",
        occupied: status === "occupied",
        reserved: status === "reserved",
        billing: status === "billing",
        cleaning: status === "cleaning",
      };
    });
  };

  const handleResetAllFilters = () => {
    setSelectedAreaFilter("All");
    setActiveStatuses(INITIAL_STATUS_FILTERS);
    setCapacityFilter("all");
    setListSearchQuery("");
  };

  // Filtered tables across area, status toggles, capacity filter, and search query
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (selectedAreaFilter !== "All" && t.area !== selectedAreaFilter) return false;
      if (!activeStatuses[t.status]) return false;
      if (capacityFilter === "2" && t.capacity !== 2) return false;
      if (capacityFilter === "4" && t.capacity !== 4) return false;
      if (capacityFilter === "6+" && t.capacity < 6) return false;

      if (listSearchQuery.trim()) {
        const q = listSearchQuery.toLowerCase();
        const ord = orders.find((o) => o.id === t.orderId);
        const cust = customers.find((c) => c.id === ord?.customerId);
        return (
          t.name.toLowerCase().includes(q) ||
          t.area.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q) ||
          (ord?.id.toLowerCase().includes(q) ?? false) ||
          (cust?.name.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [
    tables,
    selectedAreaFilter,
    activeStatuses,
    capacityFilter,
    listSearchQuery,
    orders,
    customers,
  ]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) ?? tables[0]!,
    [tables, selectedTableId],
  );

  const activeOrder = useMemo(() => {
    if (!selectedTable) return undefined;
    if (selectedTable.orderId) {
      const byId = orders.find((o) => o.id === selectedTable.orderId);
      if (byId && byId.payment === "unpaid" && byId.status !== "cancelled") return byId;
    }
    return orders.find(
      (o) =>
        o.tableId === selectedTable.id &&
        o.payment === "unpaid" &&
        o.status !== "completed" &&
        o.status !== "cancelled",
    );
  }, [selectedTable, orders]);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === activeOrder?.customerId),
    [customers, activeOrder],
  );

  const tableKots = useMemo(
    () => (activeOrder ? kots.filter((k) => k.orderId === activeOrder.id) : []),
    [kots, activeOrder],
  );

  const tableReservation = useMemo(
    () =>
      reservations.find(
        (r) =>
          r.tableId === selectedTable?.id && (r.status === "booked" || r.status === "confirmed"),
      ),
    [reservations, selectedTable],
  );

  const tableHistoryOrders = useMemo(() => {
    if (!selectedTable) return [];
    const direct = orders.filter(
      (o) =>
        o.tableId === selectedTable.id && (o.status === "completed" || o.status === "cancelled"),
    );
    if (direct.length > 0) return direct;
    // Fallback to recent completed dine-in orders in the same area
    return orders.filter((o) => o.type === "dine-in" && o.status === "completed").slice(0, 5);
  }, [orders, selectedTable]);

  // Actions
  const handleSelectTable = (tableId: string) => {
    setSelectedTableId(tableId);
    const tbl = tables.find((t) => t.id === tableId);
    if (tbl && tbl.area !== activeFloorArea) {
      setActiveFloorArea(tbl.area);
    }
  };

  const handleOpenInPos = (tableId: string) => {
    openPosForTable(tableId);
    navigate({ to: "/pos" });
  };

  const handleOpenCompleteBillingModal = () => {
    if (!activeOrder) return;
    setBillingDiscountPct(activeOrder.discountPct);
    setPaymentMethod("UPI");
    setMoveToCleaningAfterPay(true);
    setBillingModalOpen(true);
  };

  const handleConfirmCompleteBilling = () => {
    if (!activeOrder || !selectedTable) return;
    const nextStatus = moveToCleaningAfterPay ? "cleaning" : "available";
    const res = completePayment(activeOrder.id, paymentMethod, billingDiscountPct, nextStatus);
    if (!res.ok) {
      toast.error(res.error ?? "Payment failed");
      return;
    }
    setBillingModalOpen(false);
    toast.success(
      `Bill settled for ${activeOrder.id} via ${paymentMethod}. Table ${selectedTable.name} moved to ${nextStatus === "cleaning" ? "Cleaning" : "Available"}.`,
    );
    setReceiptOrder({
      ...activeOrder,
      discountPct: billingDiscountPct,
      payment: "paid",
      paymentMethod,
      status: "completed",
      paidAt: Date.now(),
    });
  };

  const handleTransferConfirm = () => {
    if (!selectedTable || !transferTargetId) return;
    const res = transferTable(selectedTable.id, transferTargetId);
    if (!res.ok) {
      toast.error(res.error ?? "Transfer failed");
      return;
    }
    toast.success(`Moved Table ${selectedTable.name} → Table ${transferTargetId}`);
    handleSelectTable(transferTargetId);
    setTransferModalOpen(false);
    setTransferTargetId("");
  };

  const handleMergeConfirm = () => {
    if (!selectedTable || !mergeTargetId) return;
    const res = mergeTables(selectedTable.id, mergeTargetId);
    if (!res.ok) {
      toast.error(res.error ?? "Merge failed");
      return;
    }
    toast.success(`Merged Table ${mergeTargetId} into Table ${selectedTable.name}`);
    setMergeModalOpen(false);
    setMergeTargetId("");
  };

  const handleSplitConfirm = () => {
    if (!activeOrder) return;
    const res = splitTableBill(activeOrder.id, splitLineIds);
    if (!res.ok) {
      toast.error(res.error ?? "Could not split bill");
      return;
    }
    toast.success(`Split bill created: ${res.newOrderId}`);
    setSplitModalOpen(false);
    setSplitLineIds([]);
  };

  const handleSaveFloorLayout = (updatedTables: DiningTable[]) => {
    saveTablesLayout(updatedTables);
    setIsEditingLayout(false);
    toast.success("Floor-plan layout saved and persisted.");
  };

  const availableTransferTables = tables.filter(
    (t) => t.id !== selectedTable?.id && t.status === "available",
  );
  const mergeCandidateTables = tables.filter((t) => t.id !== selectedTable?.id);

  return (
    <div className="space-y-4">
      {/* 1. PAGE HEADER (Breadcrumb: Operations > Floor Plan, Title, Subtitle, Right Actions) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <nav
            aria-label="Breadcrumb"
            className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Link to="/operations" className="hover:text-foreground transition-colors">
              Operations
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span className="font-semibold text-foreground">Floor Plan</span>
          </nav>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-[26px]">
            Floor Plan
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Monitor live table status, manage orders and control the flow of your restaurant.
          </p>
        </div>

        {/* Right Header Controls: Date & Time + Table List / Map View Switcher + New Order */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date and Time Display Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 text-left shadow-xs hover:bg-muted/40 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-foreground">{serviceSlot.dateLabel}</div>
                  <div className="text-[11px] font-medium text-muted-foreground tabular">
                    {serviceSlot.timeLabel}
                  </div>
                </div>
                <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Service Window</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SERVICE_SLOTS.map((slot) => (
                <DropdownMenuItem
                  key={slot.id}
                  onClick={() => {
                    setServiceSlot(slot);
                    toast.info(`Switched floor view to ${slot.shift} (${slot.timeLabel})`);
                  }}
                  className="flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold">{slot.shift}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {slot.dateLabel} · {slot.timeLabel}
                    </div>
                  </div>
                  {serviceSlot.id === slot.id && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Table List / Map View Switcher */}
          <div
            className="inline-flex items-center rounded-xl border border-border bg-card p-1 shadow-xs"
            role="group"
            aria-label="Floor View Mode"
          >
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewMode === "list"
                  ? "bg-[#EBF3FF] text-[#1769E8] border border-[#BFDBFE] shadow-2xs dark:bg-primary/20 dark:text-primary dark:border-primary/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent",
              )}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Table List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                viewMode === "map"
                  ? "bg-[#EBF3FF] text-[#1769E8] border border-[#BFDBFE] shadow-2xs dark:bg-primary/20 dark:text-primary dark:border-primary/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent",
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Map View
            </button>
          </div>

          {/* Primary Action: + New Order */}
          <Button
            onClick={() => handleOpenInPos(selectedTable?.id ?? "T1")}
            className="h-10 gap-1.5 rounded-xl bg-[#1769E8] hover:bg-[#1458C4] px-4 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(23,105,232,0.28)]"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Order
          </Button>
        </div>
      </div>

      {/* 2. SIX TABLE SUMMARY KPI CARDS */}
      <TableSummaryCards
        tables={tables}
        activeStatuses={activeStatuses}
        onSelectStatusCard={handleSelectStatusCard}
      />

      {/* 3. MAIN THREE-COLUMN WORKSPACE (Left ~220px | Center Flexible | Right ~360px) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT COLUMN: Dining Areas + Quick Filters + Table Capacity */}
        <FloorFilterSidebar
          tables={tables}
          selectedArea={selectedAreaFilter}
          onSelectArea={handleSelectSidebarArea}
          activeStatuses={activeStatuses}
          onToggleStatus={handleToggleStatusSwitch}
          capacityFilter={capacityFilter}
          onSelectCapacity={setCapacityFilter}
          onResetFilters={handleResetAllFilters}
        />

        {/* CENTER COLUMN: Interactive Floor Plan OR Table List View */}
        <div className="flex-1 min-w-0 w-full">
          {viewMode === "map" ? (
            <FloorPlanCanvas
              allTables={tables}
              visibleTables={filteredTables}
              orders={orders}
              activeFloorArea={activeFloorArea}
              selectedAreaFilter={selectedAreaFilter}
              onSelectFloorArea={handleSelectCanvasFloorArea}
              onSelectAllAreas={() => setSelectedAreaFilter("All")}
              selectedTableId={selectedTable?.id ?? "T1"}
              onSelectTable={handleSelectTable}
              onDoubleClickTable={handleOpenInPos}
              isEditingLayout={isEditingLayout}
              onStartEditingLayout={() => setIsEditingLayout(true)}
              onSaveLayout={handleSaveFloorLayout}
              onCancelEditingLayout={() => {
                setIsEditingLayout(false);
                toast.info("Floor-plan layout edits cancelled");
              }}
              onDeleteTableFromStore={deleteDiningTable}
            />
          ) : (
            /* TABLE LIST VIEW */
            <div className="surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    All Filtered Dining Tables ({filteredTables.length})
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Click any row to inspect table details on the right or launch POS
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={listSearchQuery}
                    onChange={(e) => setListSearchQuery(e.target.value)}
                    placeholder="Search table, guest, order..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                      <th className="py-3 px-4">Table</th>
                      <th className="py-3 px-3">Dining Area</th>
                      <th className="py-3 px-3">Capacity</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Elapsed</th>
                      <th className="py-3 px-3">Active Order / Guest</th>
                      <th className="py-3 px-3 text-right">Bill Total</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTables.map((t) => {
                      const ord = orders.find(
                        (o) =>
                          (o.id === t.orderId || o.tableId === t.id) &&
                          o.payment === "unpaid" &&
                          o.status !== "cancelled" &&
                          o.status !== "completed",
                      );
                      const cust = customers.find((c) => c.id === ord?.customerId);
                      const cfg = TABLE_STATUS_CONFIG[t.status];
                      const elapsed = t.since
                        ? minutesSince(t.since)
                        : ord
                          ? minutesSince(ord.createdAt)
                          : 0;
                      const isRowSelected = selectedTable?.id === t.id;

                      return (
                        <tr
                          key={t.id}
                          onClick={() => handleSelectTable(t.id)}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/40",
                            isRowSelected && "bg-primary/5",
                          )}
                        >
                          <td className="py-3 px-4 font-extrabold text-foreground">{t.name}</td>
                          <td className="py-3 px-3 text-muted-foreground">{t.area}</td>
                          <td className="py-3 px-3">
                            {t.guests > 0 ? `${t.guests} / ${t.capacity}` : `${t.capacity} seats`}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                                cfg.badgeClasses,
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotColor)} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 tabular text-muted-foreground">
                            {elapsed > 0 ? (
                              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {elapsed}m
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {ord ? (
                              <div>
                                <span className="font-mono font-bold text-foreground">
                                  #{ord.id}
                                </span>
                                {cust && (
                                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                                    • {cust.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold tabular">
                            {ord ? inr(orderTotal(ord, settings.gstPct)) : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {t.status === "cleaning" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTableStatus(t.id, "available");
                                    toast.success(`Table ${t.name} marked Clean & Available`);
                                  }}
                                >
                                  <Sparkles className="mr-1 h-3 w-3" />
                                  Mark Clean
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInPos(t.id);
                                  }}
                                >
                                  {ord ? "Edit Order" : "Open POS"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Contextual Selected Table Details Panel */}
        {selectedTable && (
          <TableDetailsPanel
            selectedTable={selectedTable}
            allTables={tables}
            activeOrder={activeOrder}
            activeCustomer={activeCustomer}
            customers={customers}
            menu={menu}
            tableKots={tableKots}
            tableReservation={tableReservation}
            tableHistoryOrders={tableHistoryOrders}
            staff={staff}
            gstPct={settings.gstPct}
            onOpenPos={handleOpenInPos}
            onOpenCompleteBilling={handleOpenCompleteBillingModal}
            onRequestBill={(orderId) => {
              requestBill(orderId);
              toast.info(`Table ${selectedTable.name} moved to Billing status`);
            }}
            onOpenTransfer={() => {
              setTransferTargetId(availableTransferTables[0]?.id ?? "");
              setTransferModalOpen(true);
            }}
            onOpenMerge={() => {
              setMergeTargetId(mergeCandidateTables[0]?.id ?? "");
              setMergeModalOpen(true);
            }}
            onOpenSplit={() => {
              if (!activeOrder) return;
              setSplitLineIds(
                activeOrder.lines
                  .slice(Math.ceil(activeOrder.lines.length / 2))
                  .map((l) => l.lineId),
              );
              setSplitModalOpen(true);
            }}
            onPrintKot={() => {
              if (!activeOrder) return;
              toast.success(
                `Printed KOT ticket(s) for #${activeOrder.id} (${tableKots.length || 1} station slips)`,
              );
            }}
            onPreviewReceipt={(ord) => setReceiptOrder(ord)}
            onMarkOrderServed={(orderId) => {
              markOrderServed(orderId);
              toast.success(`Marked all dishes served for #${orderId}`);
            }}
            onCancelOrder={(orderId) => {
              const res = cancelOrder(orderId);
              if (res.ok) {
                toast.info(`Cancelled order #${orderId}`);
              } else {
                toast.error(res.error ?? "Could not cancel order");
              }
            }}
            onSetTableStatus={setTableStatus}
            onSeatReservation={(resId, tableId) => {
              updateReservationStatus(resId, "seated", tableId);
              toast.success(`Seated reservation at Table ${selectedTable.name}`);
            }}
            onStartEditLayout={() => {
              setViewMode("map");
              setIsEditingLayout(true);
            }}
          />
        )}
      </div>

      {/* Complete Billing & Settlement Dialog */}
      <Dialog open={billingModalOpen} onOpenChange={setBillingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Complete Billing — Table {selectedTable?.name}
            </DialogTitle>
            <DialogDescription>
              Settle order #{activeOrder?.id} and update table availability.
            </DialogDescription>
          </DialogHeader>

          {activeOrder &&
            (() => {
              const bill = totals(activeOrder.lines, billingDiscountPct, settings.gstPct);
              return (
                <div className="space-y-4 py-2 text-xs">
                  {/* Bill Summary Box */}
                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1.5">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Items ({activeOrder.lines.length} dishes)</span>
                      <span className="font-semibold text-foreground tabular">
                        {inr(bill.subtotal)}
                      </span>
                    </div>
                    {billingDiscountPct > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Discount ({billingDiscountPct}%)</span>
                        <span className="font-semibold tabular">-{inr(bill.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST ({settings.gstPct}%)</span>
                      <span className="font-semibold text-foreground tabular">{inr(bill.gst)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-sm font-extrabold text-foreground">
                      <span>Total Payable</span>
                      <span className="text-base text-primary tabular">{inr(bill.total)}</span>
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Payment Method</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["UPI", "Card", "Cash"] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={cn(
                            "rounded-xl border py-2.5 text-xs font-bold transition-all",
                            paymentMethod === method
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                              : "border-border bg-background text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional Discount Selector */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        Discount (Max {settings.maxDiscountPct}%)
                      </Label>
                      <div className="flex gap-1">
                        {[0, 5, 10, 15].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setBillingDiscountPct(pct)}
                            className={cn(
                              "rounded border px-2 py-0.5 text-[11px] font-semibold",
                              billingDiscountPct === pct
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-muted-foreground",
                            )}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Post-Service Table Lifecycle Checkbox */}
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/20 p-3">
                    <Checkbox
                      checked={moveToCleaningAfterPay}
                      onCheckedChange={(v) => setMoveToCleaningAfterPay(Boolean(v))}
                    />
                    <div>
                      <div className="font-semibold text-foreground">
                        Move Table {selectedTable?.name} to Cleaning after payment
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Housekeeping can mark the table Available once sanitized
                      </div>
                    </div>
                  </label>
                </div>
              );
            })()}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedTable?.status !== "billing" && activeOrder && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  requestBill(activeOrder.id);
                  setBillingModalOpen(false);
                  toast.info(`Table ${selectedTable?.name} marked as Billing`);
                }}
                className="text-xs"
              >
                Print Bill Only
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBillingModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCompleteBilling}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm & Settle ({paymentMethod})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer / Move Table Dialog */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Table {selectedTable?.name}</DialogTitle>
            <DialogDescription>
              Transfer guests and active order #{activeOrder?.id} to another available table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Destination Available Table</Label>
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an available table" />
              </SelectTrigger>
              <SelectContent>
                {availableTransferTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.name} ({t.area} · {t.capacity} seats)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleTransferConfirm} disabled={!transferTargetId}>
              Confirm Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Tables Dialog */}
      <Dialog open={mergeModalOpen} onOpenChange={setMergeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Into Table {selectedTable?.name}</DialogTitle>
            <DialogDescription>
              Combine covers and active order items from a secondary table into Table{" "}
              {selectedTable?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Secondary Table to Merge</Label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose table to merge" />
              </SelectTrigger>
              <SelectContent>
                {mergeCandidateTables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Table {t.name} ({t.area} · {t.status.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMergeModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleMergeConfirm} disabled={!mergeTargetId}>
              Merge Tables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Bill Dialog */}
      <Dialog open={splitModalOpen} onOpenChange={setSplitModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Split Bill — #{activeOrder?.id}</DialogTitle>
            <DialogDescription>
              Select the item lines to move into a separate split bill order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            {activeOrder?.lines.map((line) => {
              const checked = splitLineIds.includes(line.lineId);
              return (
                <label
                  key={line.lineId}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-2.5 text-xs hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSplitLineIds((prev) =>
                          v ? [...prev, line.lineId] : prev.filter((id) => id !== line.lineId),
                        );
                      }}
                    />
                    <span>
                      {line.qty} × {line.name}
                    </span>
                  </div>
                  <span className="font-semibold tabular">{inr(lineTotal(line))}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSplitModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSplitConfirm}>
              Create Split Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt Modal */}
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
