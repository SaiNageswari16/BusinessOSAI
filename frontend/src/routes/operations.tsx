import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  DollarSign,
  Plus,
  Sparkles,
  UserCheck,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  seatTable,
  setTableStatus,
  settleOrder,
  useOrders,
  useReservations,
  useSettings,
  useTables,
} from "@/services/orderService";
import { computeBill, orderTotal } from "@/lib/billing";
import { money } from "@/lib/format";
import type { PaymentMethod, RestaurantTable } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReceiptDialog } from "@/components/common/ReceiptDialog";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "Operations & Tables — RestaurantOS" },
      {
        name: "description",
        content: "Live floor plan, table status, seating and billing for front-of-house.",
      },
      { property: "og:title", content: "Operations & Tables — RestaurantOS" },
      {
        property: "og:description",
        content: "Live floor plan, table status, seating and billing for front-of-house.",
      },
    ],
  }),
  component: Operations,
});

const statusStyle: Record<RestaurantTable["status"], string> = {
  Available: "border-success/40 bg-success/6",
  Occupied: "border-info/50 bg-info/10",
  Reserved: "border-ai/40 bg-ai/8",
  Cleaning: "border-border bg-muted",
  Billing: "border-warning/50 bg-warning/12",
};

function Operations() {
  const navigate = useNavigate();
  const tables = useTables();
  const orders = useOrders();
  const reservations = useReservations();
  const settings = useSettings();

  const [area, setArea] = useState<"All" | RestaurantTable["area"]>("All");
  const [sel, setSel] = useState<string | null>(null);

  // Walk-in seating modal
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [selectedSeatTable, setSelectedSeatTable] = useState<RestaurantTable | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [customerName, setCustomerName] = useState("Walk-in Guest");

  // Bill settlement & receipt modal
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethod>("UPI");

  const t = tables.find((x) => x.id === sel);
  const order = t?.orderId ? orders.find((o) => o.id === t.orderId) : undefined;
  const count = (s: RestaurantTable["status"]) => tables.filter((x) => x.status === s).length;

  const reservationForTable = t
    ? reservations.find((r) => r.table === t.id && r.status === "Confirmed")
    : undefined;

  const orderBill = order
    ? computeBill(order.lines, {
        taxRate: settings.taxRate,
        serviceCharge: settings.serviceCharge,
        discountPct: 0,
        dineIn: true,
      })
    : null;

  const handleSeatWalkin = () => {
    if (!selectedSeatTable) return;
    seatTable(selectedSeatTable.id, guestCount, customerName, "Ananya");
    toast.success(`Table ${selectedSeatTable.id} seated with ${guestCount} guests`);
    setSeatModalOpen(false);
    navigate({ to: "/pos" });
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Front of house"
        title="Operations"
        description="Live floor status across all dining areas."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const firstFree = tables.find((tab) => tab.status === "Available");
                if (!firstFree) {
                  toast.error("No tables currently available");
                  return;
                }
                setSelectedSeatTable(firstFree);
                setGuestCount(firstFree.seats);
                setSeatModalOpen(true);
              }}
            >
              <UserCheck className="size-4 mr-1.5" /> Seat walk-in
            </Button>
            <Button asChild>
              <Link to="/pos">
                <Utensils className="size-4 mr-1.5" /> Open POS
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["Available", "Occupied", "Reserved", "Billing", "Cleaning"] as const).map((s) => (
          <KpiCard key={s} label={s} value={String(count(s))} sub={`of ${tables.length} tables`} />
        ))}
      </div>

      <Panel
        title="Interactive Floor Plan"
        action={
          <div className="flex rounded-md border p-0.5">
            {(["All", "Main Hall", "Terrace", "Private"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setArea(a)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs",
                  a === area ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {tables
            .filter((x) => area === "All" || x.area === area)
            .map((x) => {
              const o = x.orderId ? orders.find((y) => y.id === x.orderId) : undefined;
              return (
                <button
                  key={x.id}
                  onClick={() => setSel(x.id)}
                  className={cn(
                    "flex aspect-[4/3] flex-col rounded-lg border-2 p-3 text-left transition hover:shadow-pop",
                    statusStyle[x.status],
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{x.id}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      {x.guests ?? 0}/{x.seats}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{x.area}</span>
                  <div className="mt-auto flex items-end justify-between">
                    <StatusBadge status={x.status} />
                    {o && (
                      <span className="text-xs font-medium tabular">
                        {money(orderTotal(o.lines))}
                      </span>
                    )}
                  </div>
                  {x.seatedMins !== undefined && (
                    <span className="mt-1 text-[10px] text-muted-foreground">
                      {x.seatedMins} min · {x.waiter}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </Panel>

      {/* Table Detail Sheet */}
      <Sheet open={!!t} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {t && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  Table {t.id} <StatusBadge status={t.status} />
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md bg-surface py-2">
                    <div className="font-semibold">{t.seats}</div>
                    <div className="text-[11px] text-muted-foreground">Capacity</div>
                  </div>
                  <div className="rounded-md bg-surface py-2">
                    <div className="font-semibold">{t.guests ?? 0}</div>
                    <div className="text-[11px] text-muted-foreground">Seated</div>
                  </div>
                  <div className="rounded-md bg-surface py-2">
                    <div className="font-semibold">{t.area}</div>
                    <div className="text-[11px] text-muted-foreground">Zone</div>
                  </div>
                </div>

                {reservationForTable && (
                  <div className="rounded-lg border border-ai/40 bg-ai/10 p-3 text-xs space-y-1">
                    <div className="font-semibold text-ai flex items-center gap-1">
                      <Sparkles className="size-3.5" /> Reserved Booking
                    </div>
                    <div>
                      Guest: <b>{reservationForTable.name}</b> ({reservationForTable.guests} covers)
                    </div>
                    <div>
                      Time: {reservationForTable.time}{" "}
                      {reservationForTable.occasion ? `· ${reservationForTable.occasion}` : ""}
                    </div>
                  </div>
                )}

                {order ? (
                  <div className="rounded-lg border">
                    <div className="flex justify-between border-b px-3 py-2 text-sm">
                      <span className="font-mono font-medium">{order.id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <ul className="divide-y text-sm max-h-48 overflow-y-auto">
                      {order.lines.map((l) => (
                        <li key={l.id} className="flex justify-between px-3 py-2">
                          <span>
                            {l.qty}× {l.name}
                          </span>
                          <span className="tabular">{money(l.qty * l.unitPrice)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between border-t px-3 py-2 font-semibold">
                      <span>Subtotal</span>
                      <span className="tabular">{money(orderTotal(order.lines))}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active order on this table.</p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {t.status === "Available" && (
                    <Button
                      className="col-span-2"
                      onClick={() => {
                        setSelectedSeatTable(t);
                        setGuestCount(t.seats);
                        setSeatModalOpen(true);
                      }}
                    >
                      <UserCheck className="size-4 mr-1.5" /> Seat table & start order
                    </Button>
                  )}
                  {t.status === "Occupied" && (
                    <Button onClick={() => setTableStatus(t.id, "Billing")}>Request bill</Button>
                  )}
                  {order && (
                    <Button
                      variant={t.status === "Billing" ? "default" : "outline"}
                      onClick={() => setPayPickerOpen(true)}
                    >
                      <Wallet className="size-4 mr-1.5" /> Settle & close
                    </Button>
                  )}
                  {t.status === "Cleaning" && (
                    <Button
                      className="col-span-2"
                      onClick={() => {
                        setTableStatus(t.id, "Available");
                        toast.success(`Table ${t.id} marked clean and available`);
                      }}
                    >
                      <CheckCircle2 className="size-4 mr-1.5" /> Mark clean
                    </Button>
                  )}
                  {t.status === "Reserved" && (
                    <Button
                      className="col-span-2"
                      onClick={() => {
                        setTableStatus(t.id, "Occupied");
                        toast.success(`Guests arrived at Table ${t.id}`);
                      }}
                    >
                      <UserCheck className="size-4 mr-1.5" /> Guests arrived / Seat table
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Seat Table Modal */}
      <Dialog open={seatModalOpen} onOpenChange={setSeatModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Seat Table {selectedSeatTable?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Customer / Party Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in guest or name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Number of Guests</Label>
              <Input
                type="number"
                min={1}
                max={selectedSeatTable?.seats || 10}
                value={guestCount}
                onChange={(e) => setGuestCount(parseInt(e.target.value, 10) || 1)}
              />
              <span className="text-[11px] text-muted-foreground">
                Table capacity: {selectedSeatTable?.seats} seats
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeatModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSeatWalkin}>Confirm & Start POS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Payment Modal */}
      <Dialog open={payPickerOpen} onOpenChange={setPayPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle Table {t?.id}</DialogTitle>
          </DialogHeader>
          {orderBill && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="eyebrow">Grand Total Due</div>
                <div className="text-3xl font-semibold tabular">{money(orderBill.total)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["Cash", "UPI", "Card", "Wallet"] as const).map((method) => (
                  <Button
                    key={method}
                    variant="outline"
                    className="h-14 font-semibold hover:border-primary"
                    onClick={() => {
                      if (order) {
                        settleOrder(order.id, method);
                        setActivePaymentMethod(method);
                        setPayPickerOpen(false);
                        setReceiptOpen(true);
                        toast.success(`Table ${t?.id} settled via ${method}`);
                      }
                    }}
                  >
                    {method}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt / Invoice Dialog */}
      <ReceiptDialog
        order={order ?? null}
        bill={orderBill}
        paymentMethod={activePaymentMethod}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />
    </PageContainer>
  );
}
