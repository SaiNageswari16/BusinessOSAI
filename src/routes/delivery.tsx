import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Box, CheckCircle2, Clock, Plus, Printer, Send, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { ReceiptModal } from "@/components/shared/ReceiptModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr, minutesSince, orderTotal } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/delivery")({
  component: DeliveryScreen,
});

const STAGES: { key: "packing" | "dispatched" | "delivered"; label: string; desc: string }[] = [
  { key: "packing", label: "Packing & QA", desc: "Awaiting KOT completion & thermal sealing" },
  { key: "dispatched", label: "Out for Delivery", desc: "Handed over to aggregator / fleet rider" },
  { key: "delivered", label: "Delivered", desc: "Completed doorstep drop-offs" },
];

export function DeliveryScreen() {
  const navigate = useNavigate();

  const orders = useRestaurantStore((s) => s.orders);
  const customers = useRestaurantStore((s) => s.customers);
  const staff = useRestaurantStore((s) => s.staff);
  const settings = useRestaurantStore((s) => s.settings);

  const advanceDeliveryOrder = useRestaurantStore((s) => s.advanceDeliveryOrder);
  const setPosOrderType = useRestaurantStore((s) => s.setPosOrderType);
  const clearPosCart = useRestaurantStore((s) => s.clearPosCart);

  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const deliveryOrders = useMemo(() => {
    return orders
      .filter((o) => o.type === "delivery" && o.status !== "cancelled")
      .filter((o) => providerFilter === "all" || o.provider === providerFilter)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, providerFilter]);

  const riders = useMemo(
    () => staff.filter((s) => s.role.toLowerCase().includes("rider")),
    [staff],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Delivery"
        title="Delivery Hub — Packing, Dispatch & Aggregators"
        subtitle="Manage Swiggy (demo), Zomato (demo), and Own Fleet delivery orders from packing to doorstep"
        actions={
          <Button
            size="sm"
            onClick={() => {
              clearPosCart();
              setPosOrderType("delivery");
              navigate({ to: "/pos" });
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Delivery Order
          </Button>
        }
      />

      {/* Provider Filter + Riders Status Bar */}
      <div className="surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {["all", "Swiggy (demo)", "Zomato (demo)", "Own fleet"].map((prov) => (
            <button
              key={prov}
              type="button"
              onClick={() => setProviderFilter(prov)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                providerFilter === prov
                  ? "bg-navy text-navy-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {prov === "all" ? `All Channels (${deliveryOrders.length})` : prov}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Fleet Riders on Duty:</span>
          {riders.map((r) => (
            <Badge key={r.id} variant="outline" className="gap-1">
              <Truck className="h-3 w-3 text-primary" /> {r.name}
            </Badge>
          ))}
        </div>
      </div>

      {/* 3-Column Delivery Pipeline */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {STAGES.map((stage) => {
          const stageOrders = deliveryOrders.filter(
            (o) => (o.deliveryStage ?? "packing") === stage.key,
          );
          return (
            <div key={stage.key} className="surface p-4 flex flex-col gap-3 min-h-[420px]">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground">{stage.label}</h2>
                  <p className="text-[11px] text-muted-foreground">{stage.desc}</p>
                </div>
                <Badge variant="secondary" className="font-bold">
                  {stageOrders.length}
                </Badge>
              </div>

              <div className="space-y-3 flex-1">
                {stageOrders.slice(0, 8).map((ord) => {
                  const cust = customers.find((c) => c.id === ord.customerId);
                  const total = orderTotal(ord, settings.gstPct);
                  return (
                    <div
                      key={ord.id}
                      className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-foreground">{ord.id}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                ord.provider?.includes("Swiggy")
                                  ? "border-orange-500/40 bg-orange-500/10 text-orange-600"
                                  : ord.provider?.includes("Zomato")
                                    ? "border-red-500/40 bg-red-500/10 text-red-600"
                                    : "border-primary/40 bg-info-soft text-primary",
                              )}
                            >
                              {ord.provider ?? "Own fleet"}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {cust ? `${cust.name} (${cust.phone})` : "Online Customer"}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular">
                          <Clock className="h-3 w-3" /> {minutesSince(ord.createdAt)}m
                        </span>
                      </div>

                      <div className="rounded-lg bg-muted/30 p-2 text-[11px] space-y-0.5">
                        {ord.lines.map((l) => (
                          <div key={l.lineId} className="flex justify-between">
                            <span>
                              {l.qty} × {l.name}
                            </span>
                            <span className="tabular font-medium">₹{l.price * l.qty}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="font-bold text-sm tabular">{inr(total)}</span>
                          <span className="ml-1.5 text-[10px] uppercase font-semibold text-success">
                            {ord.payment}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => setReceiptOrder(ord)}
                            title="Print Delivery Label & Invoice"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          {stage.key === "packing" && (
                            <Button
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                advanceDeliveryOrder(ord.id);
                                toast.success(`${ord.id} dispatched with rider!`);
                              }}
                            >
                              <Send className="h-3 w-3" /> Dispatch
                            </Button>
                          )}
                          {stage.key === "dispatched" && (
                            <Button
                              size="sm"
                              className="h-7 gap-1 bg-success text-white hover:bg-success/90 text-xs"
                              onClick={() => {
                                advanceDeliveryOrder(ord.id);
                                toast.success(`${ord.id} marked as Delivered!`);
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Delivered
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
