import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  LayoutGrid,
  List,
  Play,
  Printer,
  Timer,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { minutesSince } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Kot, KotStatus, OrderType, Station } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kot")({
  component: KotScreen,
});

const STATIONS: ("All" | Station)[] = [
  "All",
  "Tandoor",
  "Curry",
  "Biryani",
  "Desserts",
  "Beverages",
];

const COLUMNS: { status: KotStatus; label: string; tone: string }[] = [
  {
    status: "new",
    label: "New Tickets",
    tone: "border-destructive/40 bg-danger-soft/50 text-destructive",
  },
  { status: "accepted", label: "Accepted", tone: "border-primary/40 bg-info-soft/60 text-primary" },
  {
    status: "preparing",
    label: "Preparing",
    tone: "border-warning/40 bg-warning-soft/60 text-warning",
  },
  {
    status: "ready",
    label: "Ready for Pickup",
    tone: "border-success/40 bg-success-soft/60 text-success",
  },
];

export function KotScreen() {
  const navigate = useNavigate();

  const kots = useRestaurantStore((s) => s.kots);
  const orders = useRestaurantStore((s) => s.orders);
  const updateKotStatus = useRestaurantStore((s) => s.updateKotStatus);

  const [stationFilter, setStationFilter] = useState<"All" | Station>("All");
  const [typeFilter, setTypeFilter] = useState<"all" | OrderType>("all");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  const activeKots = useMemo(() => {
    return kots.filter((k) => {
      if (k.status === "served") return false;
      if (stationFilter !== "All" && k.station !== stationFilter) return false;
      const ord = orders.find((o) => o.id === k.orderId);
      if (typeFilter !== "all" && ord?.type !== typeFilter) return false;
      return true;
    });
  }, [kots, orders, stationFilter, typeFilter]);

  const handleTransition = (kot: Kot, nextStatus: KotStatus) => {
    updateKotStatus(kot.id, nextStatus);
    toast.success(`${kot.id} (${kot.station}) → ${nextStatus.toUpperCase()}`);
  };

  const renderTransitionButton = (kot: Kot) => {
    if (kot.status === "new") {
      return (
        <Button
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() => handleTransition(kot, "accepted")}
        >
          Accept Ticket
        </Button>
      );
    }
    if (kot.status === "accepted") {
      return (
        <Button
          size="sm"
          className="h-7 flex-1 gap-1 bg-warning text-white hover:bg-warning/90 text-xs"
          onClick={() => handleTransition(kot, "preparing")}
        >
          <Play className="h-3 w-3" /> Start Preparing
        </Button>
      );
    }
    if (kot.status === "preparing") {
      return (
        <Button
          size="sm"
          className="h-7 flex-1 gap-1 bg-success text-white hover:bg-success/90 text-xs"
          onClick={() => handleTransition(kot, "ready")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Ready
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        variant="secondary"
        className="h-7 flex-1 text-xs"
        onClick={() => handleTransition(kot, "served")}
      >
        Bump / Served
      </Button>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Kitchen / KOT"
        title="Kitchen Order Tickets (KOT)"
        subtitle="Station-wise ticket routing, elapsed preparation timers, and status transitions"
        actions={
          <>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
                  viewMode === "board"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="h-3.5 w-3.5" /> Ticket List
              </button>
            </div>
            <Button
              size="sm"
              onClick={() => navigate({ to: "/kds" })}
              className="gap-1.5 bg-navy text-navy-foreground hover:bg-navy/90"
            >
              <Flame className="h-4 w-4 text-amber-400" />
              Switch to KDS Full-Screen
            </Button>
          </>
        }
      />

      {/* Station & Order Type Filter Bar */}
      <div className="surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATIONS.map((st) => {
            const count =
              st === "All"
                ? kots.filter((k) => k.status !== "served").length
                : kots.filter((k) => k.status !== "served" && k.station === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStationFilter(st)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  stationFilter === st
                    ? "bg-navy text-navy-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                {st} <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {(["all", "dine-in", "takeaway", "delivery"] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setTypeFilter(tp)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                typeFilter === tp
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {tp === "all" ? "All Channels" : tp}
            </button>
          ))}
        </div>
      </div>

      {/* Board View vs List View */}
      {viewMode === "board" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const colKots = activeKots.filter((k) => k.status === col.status);
            return (
              <div key={col.status} className="surface p-3.5 flex flex-col gap-3 min-h-[420px]">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{col.label}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-xs font-bold", col.tone)}>
                    {colKots.length}
                  </Badge>
                </div>

                <div className="space-y-3 flex-1">
                  {colKots.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                      No tickets in {col.label}
                    </div>
                  ) : (
                    colKots.map((kot) => {
                      const ord = orders.find((o) => o.id === kot.orderId);
                      const elapsed = minutesSince(kot.createdAt);
                      const prepElapsed = kot.startedAt ? minutesSince(kot.startedAt) : 0;
                      const isOverdue = elapsed >= 18 && kot.status !== "ready";

                      return (
                        <div
                          key={kot.id}
                          className={cn(
                            "rounded-xl border p-3.5 space-y-2.5 bg-card shadow-2xs transition-all",
                            isOverdue
                              ? "border-destructive ring-1 ring-destructive/30"
                              : "border-border",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-extrabold text-foreground">
                                  {kot.id}
                                </span>
                                <Badge variant="secondary" className="text-[10px]">
                                  {kot.station}
                                </Badge>
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                                {kot.orderId} ·{" "}
                                <span className="uppercase font-semibold text-foreground">
                                  {ord?.type ?? "dine-in"}
                                </span>
                                {ord?.tableId ? ` · Table ${ord.tableId}` : ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular",
                                  isOverdue
                                    ? "bg-danger-soft text-destructive"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                <Clock className="h-3 w-3" /> {elapsed}m
                              </span>
                              {prepElapsed > 0 && (
                                <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] text-warning tabular">
                                  <Timer className="h-2.5 w-2.5" /> Prep {prepElapsed}m
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="divide-y divide-border/60 border-y border-border/60 py-2 space-y-1.5">
                            {kot.lines.map((line) => (
                              <div key={line.lineId} className="pt-1.5 first:pt-0 text-xs">
                                <div className="flex items-center justify-between font-bold text-foreground">
                                  <span>
                                    {line.qty} × {line.name}
                                  </span>
                                </div>
                                {(line.modifiers.length > 0 ||
                                  line.addons.length > 0 ||
                                  line.note) && (
                                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                                    {line.modifiers.map((m) => (
                                      <span
                                        key={m}
                                        className="rounded bg-warning-soft px-1.5 py-0.5 font-semibold text-warning"
                                      >
                                        {m}
                                      </span>
                                    ))}
                                    {line.addons.map((a) => (
                                      <span
                                        key={a.name}
                                        className="rounded bg-info-soft px-1.5 py-0.5 font-medium text-primary"
                                      >
                                        +{a.name}
                                      </span>
                                    ))}
                                    {line.note && (
                                      <span className="rounded bg-danger-soft px-1.5 py-0.5 font-semibold text-destructive">
                                        Note: {line.note}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5 pt-0.5">
                            {renderTransitionButton(kot)}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() =>
                                toast.success(`Printed station slip for ${kot.id} (${kot.station})`)
                              }
                              aria-label={`Print ${kot.id}`}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                  <th className="py-3 px-4">KOT #</th>
                  <th className="py-3 px-3">Order / Table</th>
                  <th className="py-3 px-3">Station</th>
                  <th className="py-3 px-3">Items & Modifiers</th>
                  <th className="py-3 px-3">Elapsed</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeKots.map((kot) => {
                  const ord = orders.find((o) => o.id === kot.orderId);
                  return (
                    <tr key={kot.id} className="hover:bg-muted/40">
                      <td className="py-2.5 px-4 font-mono font-bold">{kot.id}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold">{kot.orderId}</span>
                        {ord?.tableId && (
                          <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold">
                            {ord.tableId}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {kot.station}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {kot.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                      </td>
                      <td className="py-2.5 px-3 tabular">{minutesSince(kot.createdAt)}m</td>
                      <td className="py-2.5 px-3 uppercase font-semibold">{kot.status}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {renderTransitionButton(kot)}
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
  );
}
