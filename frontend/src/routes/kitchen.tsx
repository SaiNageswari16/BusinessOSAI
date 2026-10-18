import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setOrderStatus, useOrders } from "@/services/orderService";
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
