import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Link2, Monitor, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Panel } from "@/components/common/PageHeader";
import { setOrderStatus, useOrders } from "@/services/orderService";
import {
  kitchenService,
  type KOTListResponse,
  type KOTPrintPreview,
} from "@/services/kitchenService";
import { printersService, type Printer as PrinterRecord } from "@/services/printersService";
import { minsAgo } from "@/lib/format";
import type { KitchenStation, Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KotTicketDialog } from "@/components/common/KotTicketDialog";

export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen Display — RestaurantOS" },
      {
        name: "description",
        content: "Live kitchen display with tickets by station, timers and bump actions.",
      },
      { property: "og:title", content: "Kitchen Display — RestaurantOS" },
      {
        property: "og:description",
        content: "Live kitchen display with tickets by station, timers and bump actions.",
      },
    ],
  }),
  component: Kitchen,
});

const stations: ("All" | KitchenStation)[] = [
  "All",
  "Tandoor",
  "Main",
  "Biryani",
  "Beverages",
  "Desserts",
];
const cols = [
  { status: "New", next: "Preparing", label: "Start" },
  { status: "Preparing", next: "Ready", label: "Mark ready" },
  { status: "Ready", next: "Served", label: "Served" },
] as const;

function Kitchen() {
  const orders = useOrders();
  const [station, setStation] = useState<(typeof stations)[number]>("All");
  const [kotOrder, setKotOrder] = useState<Order | null>(null);
  const [kotOpen, setKotOpen] = useState(false);
  const [toolOpen, setToolOpen] = useState<"" | "lookup" | "printers">("");
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const visible = (o: Order) => station === "All" || o.lines.some((l) => l.station === station);

  return (
    <div className="space-y-4 px-4 py-5 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Kitchen display</h1>
        <div className="flex flex-wrap gap-1 rounded-md border bg-card p-0.5">
          {stations.map((s) => (
            <button
              key={s}
              onClick={() => setStation(s)}
              className={cn(
                "rounded px-3 py-1 text-xs",
                s === station
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className={cn("h-8 text-xs", toolOpen === "lookup" && "border-primary bg-primary/10")}
            onClick={() => setToolOpen(toolOpen === "lookup" ? "" : "lookup")}
          >
            <Search className="size-3.5" /> KOT by number
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn("h-8 text-xs", toolOpen === "printers" && "border-primary bg-primary/10")}
            onClick={() => setToolOpen(toolOpen === "printers" ? "" : "printers")}
          >
            <Printer className="size-3.5" /> Printer setup
          </Button>
        </div>
        <div className="ml-auto flex gap-4 text-xs text-muted-foreground">
          <span>
            <b className="text-foreground tabular">
              {orders.filter((o) => o.status === "New").length}
            </b>{" "}
            new
          </span>
          <span>
            <b className="text-warning tabular">
              {orders.filter((o) => o.status === "Preparing").length}
            </b>{" "}
            cooking
          </span>
          <span>
            <b className="text-success tabular">
              {orders.filter((o) => o.status === "Ready").length}
            </b>{" "}
            at pass
          </span>
        </div>
      </div>

      {/* Kitchen-level printer setup: per-station print destination */}
      {toolOpen === "printers" && (
        <StationPrinterSetup onDone={() => setToolOpen("")} />
      )}

      {/* KOT-by-number lookup + per-KOT print preview */}
      {toolOpen === "lookup" && <KotByNumber onDone={() => setToolOpen("")} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {cols.map((c) => {
          const list = orders.filter((o) => o.status === c.status && visible(o));
          return (
            <section key={c.status} className="rounded-lg bg-surface p-3">
              <header className="mb-3 flex items-center justify-between px-1">
                <span className="eyebrow">{c.status}</span>
                <span className="text-xs text-muted-foreground tabular">{list.length}</span>
              </header>
              <div className="space-y-3">
                {list.map((o) => {
                  const age = minsAgo(o.createdAt);
                  const late = age >= 20,
                    warn = age >= 12;
                  return (
                    <article
                      key={o.id}
                      className={cn("panel overflow-hidden", late && "ring-2 ring-critical/60")}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-sm",
                          late ? "bg-critical/12" : warn ? "bg-warning/12" : "bg-muted",
                        )}
                      >
                        <span className="font-mono font-semibold">{o.id.replace("ORD-", "#")}</span>
                        <span className="text-xs">{o.table ?? o.type}</span>
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold tabular",
                            late
                              ? "text-critical"
                              : warn
                                ? "text-warning"
                                : "text-muted-foreground",
                          )}
                        >
                          {age}:00
                        </span>
                      </div>
                      <ul className="space-y-1.5 px-3 py-2.5">
                        {o.lines
                          .filter((l) => station === "All" || l.station === station)
                          .map((l) => (
                            <li key={l.id} className="text-sm">
                              <span className="mr-2 font-semibold tabular">{l.qty}×</span>
                              {l.name}
                              <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                                {l.station}
                              </span>
                              {(l.modifiers.length > 0 || l.note) && (
                                <div className="pl-6 text-xs text-warning">
                                  {[...l.modifiers, l.note].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </li>
                          ))}
                      </ul>
                      <div className="border-t p-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-2.5"
                          onClick={() => {
                            setKotOrder(o);
                            setKotOpen(true);
                          }}
                        >
                          <Printer className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          variant={c.status === "Ready" ? "secondary" : "default"}
                          onClick={() => {
                            setOrderStatus(o.id, c.next);
                            toast.success(`${o.id} updated to ${c.next}`);
                          }}
                        >
                          {c.label}
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {!list.length && (
                  <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                    No tickets
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <KotTicketDialog order={kotOrder} open={kotOpen} onOpenChange={setKotOpen} />
    </div>
  );
}

// ── KDS-by-number: type an order number → its KOTs → ready/served + print ──

const kdsKotTone: Record<string, Tone> = {
  pending: "info",
  acknowledged: "info",
  preparing: "warning",
  ready: "success",
  served: "neutral",
  cancelled: "critical",
};

function KotByNumber({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<KOTListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<KOTPrintPreview | null>(null);

  const lookup = useCallback(async () => {
    if (!query.trim()) {
      toast.error("Enter an order number");
      return;
    }
    try {
      setLoading(true);
      const res = await kitchenService.getKOTsByNumber(query.trim());
      setResult(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "KOT lookup failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const openPreview = async (id: string) => {
    try {
      const p = await kitchenService.getKOTPrintPreview(id);
      setPreview(p);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No print preview available");
    }
  };

  return (
    <Panel
      title="KOT by order number"
      subtitle="Find every open KOT for an order across stations, then fire ready/served or print."
      action={
        <Button size="sm" variant="ghost" onClick={onDone}>
          Close
        </Button>
      }
      className="mb-4"
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void lookup()}
              placeholder="Order number, e.g. 1048 or ORD-1048"
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>
          <Button size="sm" variant="secondary" disabled={loading} onClick={() => void lookup()}>
            <Search className="size-3.5" /> {loading ? "Searching…" : "Lookup"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2">
            {result.tickets.length === 0 ? (
              <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                No open KOTs found for “{query}”.
              </div>
            ) : (
              result.tickets.map((t) => {
                const s = String(t.status);
                const open = s !== "served" && s !== "cancelled";
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">
                        <span className="font-mono">{t.kot_number}</span>
                        {t.table_name ? ` · ${t.table_name}` : ""}
                        {t.order_type ? ` · ${t.order_type}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.covers} covers
                        {t.priority && t.priority !== "normal" ? ` · ${t.priority}` : ""}
                        {t.fired_at ? ` · fired ${new Date(t.fired_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={s} tone={kdsKotTone[s] ?? "neutral"} />
                    {open && s !== "ready" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void (async () => {
                          try {
                            await kitchenService.markReady(t.id);
                            toast.success(`${t.kot_number} marked ready`);
                            setResult(await kitchenService.getKOTsByNumber(query.trim()));
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "Failed to mark ready");
                          }
                        })()}
                      >
                        Ready
                      </Button>
                    )}
                    {open && s === "ready" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void (async () => {
                          try {
                            await kitchenService.markServed(t.id);
                            toast.success(`${t.kot_number} marked served`);
                            setResult(await kitchenService.getKOTsByNumber(query.trim()));
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "Failed to mark served");
                          }
                        })()}
                      >
                        Served
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void openPreview(t.id)}>
                      <Printer className="size-3.5" /> Print
                    </Button>
                  </div>
                );
              })
            )}
            <p className="text-[11px] text-muted-foreground">
              “Ready”/“Served” act on the KOT's station-level status; re-lookup after a change.
              Full item-level control stays on the KDS station board.
            </p>
          </div>
        )}
      </div>

      {/* Monospace KOT print preview modal */}
      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="sm:max-w-[340px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Printer className="size-4" /> KOT {preview.kot_number}
                {preview.station_name ? ` · ${preview.station_name}` : ""}
              </DialogTitle>
            </DialogHeader>
            <KotPreviewSlip preview={preview} />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Panel>
  );
}

function KotPreviewSlip({ preview }: { preview: KOTPrintPreview }) {
  const items = (preview.items || []) as {
    name?: string;
    variant_name?: string;
    qty?: number;
    notes?: string;
    modifiers?: unknown[];
  }[];
  return (
    <div className="bg-white p-3 font-mono text-[11px] text-slate-900 shadow-2xl">
      <div className="border-b-2 border-slate-900 pb-1 text-center">
        <div className="font-bold uppercase tracking-widest">Kitchen Order Ticket</div>
        {preview.order_number && <div>Order: {preview.order_number}</div>}
        {preview.table_name && <div>Table: {preview.table_name}</div>}
        <div className="flex justify-between">
          <span>Covers: {preview.covers}</span>
          <span>{preview.priority?.toUpperCase()}</span>
        </div>
      </div>
      <div className="space-y-1.5 py-2">
        {items.length === 0 ? (
          <div className="text-center text-slate-400">No items</div>
        ) : (
          items.map((it, i) => (
            <div key={i}>
              <div className="flex justify-between font-bold">
                <span>
                  {it.qty != null ? `${it.qty}× ` : ""}
                  {it.name || it.variant_name || "item"}
                </span>
              </div>
              {(it.notes || (it.modifiers && (it.modifiers as unknown[]).length)) && (
                <div className="pl-3 text-[10px] text-rose-600">
                  → {[it.notes, ...(it.modifiers as unknown[])].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="border-t-2 border-slate-900 pt-1.5 text-center font-bold">
        {preview.item_count} item(s) ·{" "}
        {preview.fired_at
          ? new Date(preview.fired_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : ""}
      </div>
    </div>
  );
}

// ── Per-station print destination setup ─────────────────────────────────────

function StationPrinterSetup({ onDone }: { onDone: () => void }) {
  const [liveStations, setLiveStations] = useState<
    { id: string; name: string; station_type: string; printer_id?: string | null }[]
  >([]);
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [s, p] = await Promise.all([
          kitchenService.getStations(),
          printersService.getPrinters(),
        ]);
        if (cancelled) return;
        setLiveStations(
          s.map((st) => ({
            id: st.id,
            name: st.name,
            station_type: st.station_type,
            printer_id: st.printer_id ?? null,
          }))
        );
        setPrinters(p);
      } catch (e) {
        console.warn("Station/printer data unavailable:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savePrinter = async (station: (typeof liveStations)[number], printerId: string | null) => {
    try {
      await kitchenService.updateStationPrinter(station.id, { printer_id: printerId });
      toast.success(
        `${station.name} → ${printerId ? printers.find((p) => p.id === printerId)?.name ?? "printer" : "outlet default"}`
      );
      setLiveStations((prev) =>
        prev.map((s) => (s.id === station.id ? { ...s, printer_id: printerId } : s))
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save station printer");
    }
  };

  return (
    <Panel
      title="Station print destinations"
      subtitle="Point each KDS station's print output at a registered printer; “outlet default” uses the outlet's default destination."
      action={
        <Button size="sm" variant="ghost" onClick={onDone}>
          Close
        </Button>
      }
      className="mb-4"
    >
      <div className="space-y-2">
        {loading ? (
          <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
            Loading stations & printers…
          </div>
        ) : liveStations.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
            No stations yet — create one from the POS kitchen flow.
          </div>
        ) : (
          liveStations.map((st) => (
            <div key={st.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Monitor className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{st.name}</div>
                <div className="text-[11px] text-muted-foreground">{st.station_type}</div>
              </div>
              <Select
                value={st.printer_id ?? "__default__"}
                onValueChange={(v) => void savePrinter(st, v === "__default__" ? null : v)}
              >
                <SelectTrigger className="h-8 w-56 text-xs">
                  <SelectValue placeholder="Printer destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Outlet default</SelectItem>
                  {printers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.paper_width_mm || "?"}mm)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
