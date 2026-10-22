import {
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Combine,
  CreditCard,
  Edit3,
  History,
  Info,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  Sparkles,
  Split,
  User,
  Utensils,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import diningBanner from "@/assets/dining-banner.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inr, lineTotal, minutesSince, orderTotal, totals } from "@/lib/calc";
import { getCategoryImage } from "@/lib/images";
import type {
  Area,
  Customer,
  DiningTable,
  Kot,
  MenuItem,
  Order,
  Reservation,
  Staff,
  TableStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  resolveTableCanvasPosition,
  resolveTableShape,
  TABLE_STATUS_CONFIG,
} from "./operations-utils";

interface TableDetailsPanelProps {
  selectedTable: DiningTable;
  allTables: DiningTable[];
  activeOrder?: Order | undefined;
  activeCustomer?: Customer | undefined;
  customers: Customer[];
  menu: MenuItem[];
  tableKots: Kot[];
  tableReservation?: Reservation | undefined;
  tableHistoryOrders: Order[];
  staff: Staff[];
  gstPct: number;
  onOpenPos: (tableId: string) => void;
  onOpenCompleteBilling: () => void;
  onRequestBill: (orderId: string) => void;
  onOpenTransfer: () => void;
  onOpenMerge: () => void;
  onOpenSplit: () => void;
  onPrintKot: () => void;
  onPreviewReceipt: (order: Order) => void;
  onMarkOrderServed: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onSetTableStatus: (tableId: string, status: TableStatus, guests?: number) => void;
  onSeatReservation: (resId: string, tableId: string) => void;
  onStartEditLayout: () => void;
  onCloseMobilePanel?: () => void;
}

const AREA_BANNER_IMAGES: Record<Area, string> = {
  "Main Hall": diningBanner,
  Terrace: diningBanner,
  "Private Room": diningBanner,
};

function formatTime12h(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "12:30 PM";
  }
}

export function TableDetailsPanel({
  selectedTable,
  allTables,
  activeOrder,
  activeCustomer,
  menu,
  tableKots,
  tableReservation,
  tableHistoryOrders,
  staff,
  gstPct,
  onOpenPos,
  onOpenCompleteBilling,
  onRequestBill,
  onOpenTransfer,
  onOpenMerge,
  onOpenSplit,
  onPrintKot,
  onPreviewReceipt,
  onMarkOrderServed,
  onCancelOrder,
  onSetTableStatus,
  onSeatReservation,
  onStartEditLayout,
  onCloseMobilePanel,
}: TableDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<"order" | "info" | "history">("order");

  const statusCfg = TABLE_STATUS_CONFIG[selectedTable.status];
  const elapsed = selectedTable.since
    ? minutesSince(selectedTable.since)
    : activeOrder
      ? minutesSince(activeOrder.createdAt)
      : 0;

  const bannerImg = AREA_BANNER_IMAGES[selectedTable.area] ?? diningBanner;
  const resolvedPos = resolveTableCanvasPosition(selectedTable, allTables);
  const resolvedShape = resolveTableShape(selectedTable, allTables);

  const areaServer =
    staff.find((s) => s.assignment === selectedTable.area && s.present) ??
    staff.find((s) => s.role === "Captain" || s.role === "Server");

  const guestName = activeCustomer?.name ?? tableReservation?.name ?? "Ravi Kumar";
  const guestPhone = activeCustomer?.phone ?? tableReservation?.phone ?? "+91 98765 43210";

  return (
    <aside
      aria-label={`Selected Table ${selectedTable.name} Details`}
      className="surface overflow-hidden flex flex-col w-full lg:w-[350px] xl:w-[370px] shrink-0 h-fit"
    >
      {/* Top Dining-Area Atmosphere Banner Image */}
      <div className="relative h-28 w-full overflow-hidden bg-slate-900">
        <img
          src={bannerImg}
          alt={`${selectedTable.area} dining ambiance`}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

        {/* Close button */}
        <button
          type="button"
          onClick={() => {
            if (onCloseMobilePanel) {
              onCloseMobilePanel();
            } else {
              setActiveTab("order");
            }
          }}
          aria-label="Close table details"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md hover:bg-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Table Header Info: Table ID + Status Badge + Elapsed Time */}
      <div className="px-4 pt-3.5 pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
              {selectedTable.name}
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold",
                statusCfg.badgeClasses,
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", statusCfg.dotColor)} />
              {statusCfg.label}
            </span>
          </div>

          {elapsed > 0 &&
            (selectedTable.status === "occupied" ||
              selectedTable.status === "billing" ||
              selectedTable.status === "cleaning") && (
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 tabular">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <Clock className="h-3.5 w-3.5" />
                <span>{elapsed} minutes</span>
              </div>
            )}
        </div>

        <p className="mt-1 text-xs font-medium text-muted-foreground">
          {selectedTable.area} • {selectedTable.capacity} Seats
          {selectedTable.guests > 0 ? ` • ${selectedTable.guests} Guests seated` : ""}
        </p>
      </div>

      {/* Three Tabs: Current Order | Table Info | History */}
      <div
        className="grid grid-cols-3 border-b border-border bg-muted/20 px-2"
        role="tablist"
        aria-label="Table Details Tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "order"}
          onClick={() => setActiveTab("order")}
          className={cn(
            "py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px",
            activeTab === "order"
              ? "border-[#1769E8] text-[#1769E8] dark:border-primary dark:text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Current Order
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "info"}
          onClick={() => setActiveTab("info")}
          className={cn(
            "py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px",
            activeTab === "info"
              ? "border-[#1769E8] text-[#1769E8] dark:border-primary dark:text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Table Info
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          className={cn(
            "py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px",
            activeTab === "history"
              ? "border-[#1769E8] text-[#1769E8] dark:border-primary dark:text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          History
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        {activeTab === "order" && (
          <>
            {activeOrder ? (
              <div className="space-y-3.5">
                {/* Order Header: #ORD-XXXX + Time + Dine In badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold tracking-tight text-foreground">
                    #{activeOrder.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground tabular">
                      {activeOrder.id === "ORD-1042"
                        ? "11:34 AM"
                        : formatTime12h(activeOrder.createdAt)}
                    </span>
                    <span className="rounded-md bg-[#EDE9FE] px-2 py-0.5 text-[11px] font-semibold text-[#6D28D9] dark:bg-violet-500/20 dark:text-violet-300">
                      {activeOrder.type === "dine-in" ? "Dine In" : activeOrder.type.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Guest / Customer Details Row */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/25 px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border border-border text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-foreground">{guestName}</div>
                      <div className="truncate text-[11px] text-muted-foreground tabular">
                        {guestPhone}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toast.info(`Calling ${guestName} (${guestPhone})...`)}
                      title={`Call ${guestName}`}
                      aria-label={`Call ${guestName}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-primary hover:bg-muted transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success(`Sent digital order summary to ${guestName}`)}
                      title="Send Order Link"
                      aria-label="Send Order Link"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-primary hover:bg-muted transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenPos(selectedTable.id)}
                      title="Edit Guest in POS"
                      aria-label="Edit Guest in POS"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Itemized Order List with Food Thumbnails */}
                <div className="divide-y divide-border/60 max-h-60 overflow-y-auto pr-0.5">
                  {activeOrder.lines.map((line) => {
                    const menuItem = menu.find((m) => m.id === line.itemId);
                    const thumb = getCategoryImage(menuItem?.category ?? "Curries");
                    const totalForLine = lineTotal(line);
                    return (
                      <div
                        key={line.lineId}
                        className="flex items-center justify-between gap-2.5 py-2.5 first:pt-1"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={thumb}
                            alt={line.name}
                            className="h-9 w-9 shrink-0 rounded-full object-cover border border-border/80 shadow-2xs"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-foreground">
                              {line.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground tabular">
                              {line.qty} × {inr(line.price)}
                              {line.modifiers.length > 0 && (
                                <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">
                                  • {line.modifiers.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-bold text-foreground tabular shrink-0">
                          {inr(totalForLine)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal, GST & Total Summary */}
                {(() => {
                  const bill = totals(activeOrder.lines, activeOrder.discountPct, gstPct);
                  return (
                    <div className="border-t border-border pt-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="font-medium text-foreground tabular">
                          {inr(bill.subtotal)}
                        </span>
                      </div>
                      {activeOrder.discountPct > 0 && (
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Discount ({activeOrder.discountPct}%)</span>
                          <span className="font-medium tabular">-{inr(bill.discount)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>GST ({gstPct}%)</span>
                        <span className="font-medium text-foreground tabular">{inr(bill.gst)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-sm font-extrabold text-foreground">
                        <span>Total</span>
                        <span className="text-base tabular">{inr(bill.total)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Primary Action: Complete Billing */}
                <Button
                  onClick={onOpenCompleteBilling}
                  className="w-full h-10 gap-2 rounded-xl bg-[#1769E8] hover:bg-[#1458C4] text-white font-semibold text-xs shadow-[0_4px_14px_rgba(23,105,232,0.3)]"
                >
                  <CreditCard className="h-4 w-4" />
                  Complete Billing
                </Button>

                {/* Secondary Actions Row: Edit Order | Move Table | More Actions */}
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenPos(selectedTable.id)}
                    className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    Edit Order
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenTransfer}
                    className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                    Move Table
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="More Table Actions"
                        className="h-9 w-9 rounded-xl p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs">
                        Table {selectedTable.name} Actions
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {selectedTable.status !== "billing" && (
                        <DropdownMenuItem
                          onClick={() => onRequestBill(activeOrder.id)}
                          className="text-xs gap-2"
                        >
                          <Receipt className="h-3.5 w-3.5 text-amber-500" />
                          Request / Generate Bill
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={onOpenSplit} className="text-xs gap-2">
                        <Split className="h-3.5 w-3.5" />
                        Split Bill ({activeOrder.lines.length} items)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onOpenMerge} className="text-xs gap-2">
                        <Combine className="h-3.5 w-3.5" />
                        Merge Another Table
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onPrintKot} className="text-xs gap-2">
                        <Printer className="h-3.5 w-3.5" />
                        Print KOT ({tableKots.length || 1} slips)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onPreviewReceipt(activeOrder)}
                        className="text-xs gap-2"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Preview Receipt
                      </DropdownMenuItem>
                      {activeOrder.status !== "served" && (
                        <DropdownMenuItem
                          onClick={() => onMarkOrderServed(activeOrder.id)}
                          className="text-xs gap-2"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          Mark All Dishes Served
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onCancelOrder(activeOrder.id)}
                        className="text-xs gap-2 text-destructive focus:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel Order
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ) : selectedTable.status === "cleaning" ? (
              /* Table in Cleaning Lifecycle State (No Active Billable Order) */
              <div className="rounded-2xl border border-border bg-muted/25 p-5 text-center space-y-3.5 my-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Table {selectedTable.name} is Being Cleaned
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Housekeeping is sanitizing and resetting {selectedTable.capacity} covers for the
                    next party.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    onSetTableStatus(selectedTable.id, "available");
                    toast.success(`Table ${selectedTable.name} is now Clean & Available`);
                  }}
                  className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Clean & Available
                </Button>
              </div>
            ) : tableReservation ? (
              /* Reserved Table State (No Active Billable Order Yet) */
              <div className="space-y-3.5 my-1">
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                      <CalendarClock className="h-4 w-4" />
                      Upcoming Reservation
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {tableReservation.time}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{tableReservation.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Party of {tableReservation.party} • {tableReservation.phone}
                    </div>
                  </div>
                  {tableReservation.request && (
                    <div className="rounded-lg bg-background/80 px-2.5 py-1.5 text-[11px] text-muted-foreground italic">
                      Note: "{tableReservation.request}"
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    onSeatReservation(tableReservation.id, selectedTable.id);
                  }}
                  className="w-full gap-1.5 bg-[#1769E8] hover:bg-[#1458C4] text-white text-xs font-semibold"
                >
                  <Utensils className="h-4 w-4" />
                  Seat Party & Mark Occupied
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenPos(selectedTable.id)}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Open POS for Table {selectedTable.name}
                </Button>
              </div>
            ) : (
              /* Available Table State (No Active Billable Order) */
              <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-5 text-center space-y-3.5 my-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Utensils className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Table {selectedTable.name} is Ready to Seat
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No active order on this table ({selectedTable.capacity} seats in{" "}
                    {selectedTable.area}). Start a dine-in order or seat walk-in guests.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={() => onOpenPos(selectedTable.id)}
                    className="w-full gap-1.5 bg-[#1769E8] hover:bg-[#1458C4] text-white text-xs font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    New Order on {selectedTable.name}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onSetTableStatus(selectedTable.id, "occupied", selectedTable.capacity);
                        toast.success(`Walk-in party seated at Table ${selectedTable.name}`);
                      }}
                      className="text-xs"
                    >
                      Seat Walk-In
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onSetTableStatus(selectedTable.id, "reserved", selectedTable.capacity);
                        toast.info(`Table ${selectedTable.name} marked as Reserved`);
                      }}
                      className="text-xs"
                    >
                      Hold / Reserve
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "info" && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Info className="h-4 w-4 text-primary" />
                <span>Table Configuration</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="rounded-lg bg-background p-2.5 border border-border/60">
                  <div className="text-[10px] text-muted-foreground uppercase">Table ID</div>
                  <div className="mt-0.5 text-sm font-extrabold text-foreground">
                    {selectedTable.name}
                  </div>
                </div>
                <div className="rounded-lg bg-background p-2.5 border border-border/60">
                  <div className="text-[10px] text-muted-foreground uppercase">Dining Area</div>
                  <div className="mt-0.5 text-sm font-bold text-foreground">
                    {selectedTable.area}
                  </div>
                </div>
                <div className="rounded-lg bg-background p-2.5 border border-border/60">
                  <div className="text-[10px] text-muted-foreground uppercase">Capacity</div>
                  <div className="mt-0.5 text-sm font-bold text-foreground">
                    {selectedTable.capacity} Seats
                  </div>
                </div>
                <div className="rounded-lg bg-background p-2.5 border border-border/60">
                  <div className="text-[10px] text-muted-foreground uppercase">Table Shape</div>
                  <div className="mt-0.5 text-sm font-bold capitalize text-foreground">
                    {resolvedShape === "round" ? "Circular" : "Rectangular"}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                <span>Floor Position (Normalized)</span>
                <span className="font-mono font-semibold text-foreground">
                  X: {Math.round(resolvedPos.x * 100)}% · Y: {Math.round(resolvedPos.y * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Assigned Captain / Server</span>
                <span className="font-semibold text-foreground">
                  {areaServer ? `${areaServer.name} (${areaServer.role})` : "Anil Yadav"}
                </span>
              </div>
            </div>

            {/* Quick Status Lifecycle Switcher */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Table Status Lifecycle
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  ["available", "occupied", "reserved", "billing", "cleaning"] as TableStatus[]
                ).map((st) => {
                  const cfg = TABLE_STATUS_CONFIG[st];
                  const isCurrent = selectedTable.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        if (
                          (st === "available" || st === "cleaning") &&
                          activeOrder &&
                          activeOrder.payment === "unpaid"
                        ) {
                          toast.error(
                            `Complete or cancel active order #${activeOrder.id} before marking Table ${selectedTable.name} ${st}.`,
                          );
                          return;
                        }
                        onSetTableStatus(selectedTable.id, st);
                        toast.success(`Table ${selectedTable.name} status updated to ${cfg.label}`);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all",
                        isCurrent
                          ? "border-primary bg-primary/10 text-primary shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", cfg.dotColor)} />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onStartEditLayout}
              className="w-full gap-1.5 text-xs font-semibold"
            >
              <Edit3 className="h-3.5 w-3.5 text-primary" />
              Edit Table Position & Shape on Map
            </Button>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4 text-primary" />
                Recent Orders on {selectedTable.name}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {tableHistoryOrders.length} records
              </Badge>
            </div>

            {tableHistoryOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-muted-foreground">
                No completed historical orders recorded for Table {selectedTable.name} today.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                {tableHistoryOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">#{ord.id}</span>
                        <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                          {ord.paymentMethod ?? ord.status}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {ord.lines.length} items • {ord.guests} guests •{" "}
                        {formatTime12h(ord.createdAt)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-extrabold text-foreground tabular">
                        {inr(orderTotal(ord, gstPct))}
                      </div>
                      <button
                        type="button"
                        onClick={() => onPreviewReceipt(ord)}
                        className="mt-0.5 text-[11px] font-semibold text-primary hover:underline"
                      >
                        Receipt →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
