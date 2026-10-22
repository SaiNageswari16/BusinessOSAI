import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Play,
  Printer,
  Timer,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { minutesSince } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Kot, KotStatus, Station } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kds")({
  component: KdsScreen,
});

const STATIONS: ("All" | Station)[] = [
  "All",
  "Tandoor",
  "Curry",
  "Biryani",
  "Desserts",
  "Beverages",
];

export function KdsScreen() {
  const navigate = useNavigate();

  const kots = useRestaurantStore((s) => s.kots);
  const orders = useRestaurantStore((s) => s.orders);
  const updateKotStatus = useRestaurantStore((s) => s.updateKotStatus);

  const [stationFilter, setStationFilter] = useState<"All" | Station>("All");
  const [statusFilter, setStatusFilter] = useState<"active" | KotStatus>("active");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const visibleKots = useMemo(() => {
    const list = kots.filter((k) => {
      if (statusFilter === "active") {
        if (k.status === "served") return false;
      } else if (k.status !== statusFilter) {
        return false;
      }
      if (stationFilter !== "All" && k.station !== stationFilter) return false;
      return true;
    });

    // Sort overdue / oldest first so kitchen prioritizes urgent tickets
    return [...list].sort((a, b) => a.createdAt - b.createdAt);
  }, [kots, stationFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = kots.filter((k) => k.status !== "served");
    const overdue = active.filter((k) => minutesSince(k.createdAt) >= 15 && k.status !== "ready");
    const preparing = active.filter((k) => k.status === "preparing");
    const ready = active.filter((k) => k.status === "ready");
    return {
      totalActive: active.length,
      overdue: overdue.length,
      preparing: preparing.length,
      ready: ready.length,
    };
  }, [kots]);

  const toggleLineCheck = (kotId: string, lineId: string) => {
    const key = `${kotId}:${lineId}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStatusChange = (kot: Kot, nextStatus: KotStatus) => {
    updateKotStatus(kot.id, nextStatus);
    toast.success(`KDS: ${kot.id} marked ${nextStatus.toUpperCase()}`);
  };

  return (
    <div className="space-y-4">
      {/* KDS Top Command Bar */}
      <div className="rounded-2xl bg-navy p-4 text-navy-foreground shadow-md border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white">
                  Kitchen Display System (KDS)
                </h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                  LIVE SYNC
                </Badge>
              </div>
              <p className="text-xs text-white/70">
                High-visibility kitchen production board · Click items to strike off as plated
              </p>
            </div>
          </div>

          {/* KDS Live Metrics Strip */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-1.5">
              <span className="text-white/65">Active Tickets:</span>{" "}
              <strong className="text-sm font-extrabold text-white tabular">
                {stats.totalActive}
              </strong>
            </div>
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-1.5">
              <span className="text-amber-200">Preparing:</span>{" "}
              <strong className="text-sm font-extrabold text-amber-300 tabular">
                {stats.preparing}
              </strong>
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5">
              <span className="text-emerald-200">Ready:</span>{" "}
              <strong className="text-sm font-extrabold text-emerald-300 tabular">
                {stats.ready}
              </strong>
            </div>
            {stats.overdue > 0 && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/25 px-3 py-1.5 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-300" />
                <span className="text-red-100 font-semibold">
                  {stats.overdue} Overdue (&gt;15m)
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/kot" })}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Standard KOT View
            </Button>
          </div>
        </div>

        {/* Station & Status Filters */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStationFilter(st)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                  stationFilter === st
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/8 text-white/75 hover:bg-white/15 hover:text-white",
                )}
              >
                {st === "All" ? "All Stations" : st}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(["active", "new", "accepted", "preparing", "ready"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold uppercase transition-colors",
                  statusFilter === st
                    ? "bg-amber-500 text-slate-950"
                    : "bg-white/8 text-white/70 hover:bg-white/15",
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Large Readable KDS Ticket Grid */}
      {visibleKots.length === 0 ? (
        <div className="surface py-16 text-center space-y-2">
          <ChefHat className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <div className="text-base font-bold text-foreground">All Clear on This Station!</div>
          <p className="text-xs text-muted-foreground">
            New POS orders sent to the kitchen will appear here immediately.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleKots.map((kot) => {
            const ord = orders.find((o) => o.id === kot.orderId);
            const elapsed = minutesSince(kot.createdAt);
            const prepMins = kot.startedAt ? minutesSince(kot.startedAt) : 0;
            const isOverdue = elapsed >= 15 && kot.status !== "ready";

            const headerTone =
              kot.status === "ready"
                ? "bg-emerald-600 text-white"
                : isOverdue
                  ? "bg-red-600 text-white"
                  : kot.status === "preparing"
                    ? "bg-amber-500 text-slate-950"
                    : kot.status === "accepted"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-white";

            return (
              <div
                key={kot.id}
                className={cn(
                  "surface overflow-hidden flex flex-col justify-between border-2 transition-all",
                  isOverdue
                    ? "border-destructive shadow-lg"
                    : kot.status === "ready"
                      ? "border-success/60"
                      : "border-border",
                )}
              >
                {/* Ticket Header */}
                <div>
                  <div className={cn("px-4 py-3 flex items-center justify-between", headerTone)}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black tracking-tight">
                          {kot.id}
                        </span>
                        <span className="rounded bg-black/20 px-2 py-0.5 text-xs font-bold uppercase">
                          {kot.station}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs font-semibold opacity-90">
                        {kot.orderId} ·{" "}
                        {ord?.tableId
                          ? `TABLE ${ord.tableId}`
                          : (ord?.type ?? "TAKEAWAY").toUpperCase()}
                        {ord?.provider ? ` (${ord.provider})` : ""}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-base font-black tabular">
                        <Clock className="h-4 w-4" />
                        {elapsed}m
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-90">
                        {isOverdue ? "OVERDUE" : kot.status}
                      </div>
                    </div>
                  </div>

                  {/* Prep Timer Subbar */}
                  <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-1.5 text-xs">
                    <span className="font-medium text-muted-foreground">
                      Status: <strong className="text-foreground uppercase">{kot.status}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-semibold tabular text-muted-foreground">
                      <Timer className="h-3.5 w-3.5 text-warning" />
                      {prepMins > 0 ? `Cooking: ${prepMins}m` : "Not started"}
                    </span>
                  </div>

                  {/* Large Item Lines */}
                  <div className="divide-y divide-border p-4 space-y-2.5">
                    {kot.lines.map((line) => {
                      const done = !!checkedItems[`${kot.id}:${line.lineId}`];
                      return (
                        <div
                          key={line.lineId}
                          onClick={() => toggleLineCheck(kot.id, line.lineId)}
                          className={cn(
                            "cursor-pointer pt-2.5 first:pt-0 transition-opacity",
                            done && "opacity-45 line-through",
                          )}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-base font-extrabold text-foreground">
                              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary font-black tabular">
                                {line.qty}
                              </span>
                              {line.name}
                            </span>
                          </div>

                          {(line.modifiers.length > 0 || line.addons.length > 0 || line.note) && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-8">
                              {line.modifiers.map((mod) => (
                                <span
                                  key={mod}
                                  className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning"
                                >
                                  {mod}
                                </span>
                              ))}
                              {line.addons.map((addon) => (
                                <span
                                  key={addon.name}
                                  className="rounded-md bg-info-soft px-2 py-0.5 text-xs font-bold text-primary"
                                >
                                  +{addon.name}
                                </span>
                              ))}
                              {line.note && (
                                <div className="w-full rounded-md border border-destructive/40 bg-danger-soft px-2.5 py-1 text-xs font-bold text-destructive">
                                  CHEF NOTE: {line.note}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Large Action Footer */}
                <div className="border-t border-border bg-muted/25 p-3 flex items-center gap-2">
                  {kot.status === "new" && (
                    <Button
                      onClick={() => handleStatusChange(kot, "accepted")}
                      className="flex-1 h-10 text-xs font-bold"
                    >
                      Accept Ticket
                    </Button>
                  )}
                  {(kot.status === "new" || kot.status === "accepted") && (
                    <Button
                      onClick={() => handleStatusChange(kot, "preparing")}
                      className="flex-1 h-10 gap-1.5 bg-warning text-white hover:bg-warning/90 text-xs font-bold"
                    >
                      <Play className="h-4 w-4" />
                      Start Preparing
                    </Button>
                  )}
                  {kot.status === "preparing" && (
                    <Button
                      onClick={() => handleStatusChange(kot, "ready")}
                      className="flex-1 h-10 gap-1.5 bg-success text-white hover:bg-success/90 text-xs font-bold"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Ready
                    </Button>
                  )}
                  {kot.status === "ready" && (
                    <Button
                      onClick={() => handleStatusChange(kot, "served")}
                      variant="secondary"
                      className="flex-1 h-10 text-xs font-bold"
                    >
                      Bump Ticket (Served)
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-10 px-3"
                    onClick={() => toast.success(`Printed KDS slip ${kot.id}`)}
                    aria-label={`Print ${kot.id}`}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
