import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Truck,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adjustStock,
  autoGenerateCriticalPOs,
  receivePurchaseOrder,
  useInventory,
  usePurchaseOrders,
  useSuppliers,
} from "@/services/orderService";
import { compactMoney, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & Purchasing — RestaurantOS" },
      {
        name: "description",
        content: "Stock levels, par alerts, suppliers, purchase orders and goods receipt.",
      },
      { property: "og:title", content: "Inventory & Purchasing — RestaurantOS" },
      {
        property: "og:description",
        content: "Stock levels, par alerts, suppliers, purchase orders and goods receipt.",
      },
    ],
  }),
  component: Inventory,
});

const level = (s: number, p: number) => (s / p < 0.25 ? "Critical" : s / p < 0.6 ? "Low" : "OK");

function Inventory() {
  const items = useInventory();
  const purchaseOrders = usePurchaseOrders();
  const suppliers = useSuppliers();

  const [activeTab, setActiveTab] = useState<"stock" | "pos" | "suppliers">("stock");
  const [f, setF] = useState<"All" | "Critical" | "Low" | "OK">("All");
  const [q, setQ] = useState("");
  const [adj, setAdj] = useState<Record<string, string>>({});

  const list = items.filter(
    (i) =>
      (f === "All" || level(i.stock, i.par) === f) &&
      i.name.toLowerCase().includes(q.toLowerCase()),
  );
  const value = items.reduce((s, i) => s + i.stock * i.costPerUnit, 0);

  const handleAdjust = (id: string) => {
    const n = Number(adj[id]);
    if (isNaN(n) || n === 0) return;
    adjustStock(id, n);
    setAdj((a) => ({ ...a, [id]: "" }));
    toast.success(`Stock ${n > 0 ? "added" : "reduced"} by ${Math.abs(n)} units`);
  };

  const handleAutoPOs = () => {
    const created = autoGenerateCriticalPOs();
    if (created.length === 0) {
      toast("All stock levels are above par", {
        description: "No automated purchase orders needed right now.",
      });
    } else {
      const sum = created.reduce((s, p) => s + p.total, 0);
      toast.success(`${created.length} Purchase Order(s) generated`, {
        description: `Total procurement value: ${money(sum)}`,
      });
      setActiveTab("pos");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Back of House Logistics"
        title="Inventory & Purchasing"
        description="Central ingredient stores, real-time par monitoring, and purchase orders."
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border p-0.5">
              <button
                onClick={() => setActiveTab("stock")}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  activeTab === "stock"
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Stock Levels
              </button>
              <button
                onClick={() => setActiveTab("pos")}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  activeTab === "pos"
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Purchase Orders ({purchaseOrders.length})
              </button>
              <button
                onClick={() => setActiveTab("suppliers")}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  activeTab === "suppliers"
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Suppliers ({suppliers.length})
              </button>
            </div>
            <Button onClick={handleAutoPOs}>
              <Plus className="size-4 mr-1.5" /> Auto-generate POs
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Stock valuation" value={compactMoney(value)} />
        <KpiCard
          label="Critical stock items"
          value={String(items.filter((i) => level(i.stock, i.par) === "Critical").length)}
        />
        <KpiCard
          label="Low stock items"
          value={String(items.filter((i) => level(i.stock, i.par) === "Low").length)}
        />
        <KpiCard
          label="Active POs"
          value={String(purchaseOrders.filter((p) => p.status !== "Received").length)}
        />
      </div>

      {activeTab === "stock" && (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-ai/30 bg-ai/8 p-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-ai" />
            <span>
              Real-time synchronization active: Ingredients are automatically deducted from stock
              when kitchen orders are punched from POS.
            </span>
          </div>

          <Panel bodyClass="p-0">
            <div className="flex flex-wrap items-center gap-1.5 border-b p-3">
              {(["All", "Critical", "Low", "OK"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setF(s)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs",
                    s === f
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {s}
                </button>
              ))}
              <div className="relative ml-auto w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search ingredient..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="font-medium">Category</th>
                    <th className="w-48 font-medium">Stock / Par</th>
                    <th className="font-medium">Burn runway</th>
                    <th className="font-medium">Supplier</th>
                    <th className="text-right font-medium">Unit cost</th>
                    <th className="font-medium">Status</th>
                    <th className="px-4 font-medium">Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => {
                    const lv = level(i.stock, i.par);
                    return (
                      <tr key={i.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-2.5 font-medium">{i.name}</td>
                        <td className="text-muted-foreground">{i.category}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  lv === "Critical"
                                    ? "bg-critical"
                                    : lv === "Low"
                                      ? "bg-warning"
                                      : "bg-success",
                                )}
                                style={{ width: `${Math.min(100, (i.stock / i.par) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular font-mono">
                              {i.stock}/{i.par} {i.unit}
                            </span>
                          </div>
                        </td>
                        <td className="tabular font-mono text-xs">{i.daysLeft.toFixed(1)} days</td>
                        <td className="text-muted-foreground">{i.supplier}</td>
                        <td className="text-right tabular font-mono text-xs">
                          {money(i.costPerUnit)}
                        </td>
                        <td>
                          <StatusBadge
                            status={lv}
                            tone={
                              lv === "Critical" ? "critical" : lv === "Low" ? "warning" : "success"
                            }
                          />
                        </td>
                        <td className="px-4">
                          <form
                            className="flex gap-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAdjust(i.id);
                            }}
                          >
                            <Input
                              value={adj[i.id] ?? ""}
                              onChange={(e) => setAdj({ ...adj, [i.id]: e.target.value })}
                              placeholder="±qty"
                              className="h-7 w-16 text-xs font-mono"
                              type="number"
                            />
                            <Button size="sm" variant="outline" className="h-7 text-xs">
                              Apply
                            </Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {activeTab === "pos" && (
        <Panel title="Purchase Orders & Goods Receipt" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">PO Number</th>
                  <th className="font-medium">Supplier</th>
                  <th className="font-medium">Items included</th>
                  <th className="text-right font-medium">Order value</th>
                  <th className="font-medium pl-4">Status</th>
                  <th className="px-4 text-right font-medium">Goods receipt</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{po.poNumber}</td>
                    <td className="font-medium">{po.supplier}</td>
                    <td className="text-xs text-muted-foreground">
                      {po.items.map((it) => `${it.qty} ${it.unit} ${it.name}`).join(", ")}
                    </td>
                    <td className="text-right font-semibold tabular">{money(po.total)}</td>
                    <td className="pl-4">
                      <StatusBadge
                        status={po.status}
                        tone={
                          po.status === "Received"
                            ? "success"
                            : po.status === "Sent"
                              ? "info"
                              : "warning"
                        }
                      />
                    </td>
                    <td className="px-4 text-right">
                      {po.status !== "Received" ? (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            receivePurchaseOrder(po.id);
                            toast.success(`Goods received for ${po.poNumber}. Stock updated!`);
                          }}
                        >
                          <PackageCheck className="size-3.5 mr-1" /> Receive goods
                        </Button>
                      ) : (
                        <span className="text-xs text-success flex items-center justify-end gap-1">
                          <CheckCircle2 className="size-3.5" /> Stock received
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeTab === "suppliers" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((sup) => (
            <div key={sup.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-base">{sup.name}</div>
                  <div className="text-xs text-muted-foreground">{sup.category}</div>
                </div>
                <StatusBadge status="Verified" tone="success" />
              </div>
              <div className="border-t pt-2 space-y-1 text-xs text-muted-foreground">
                <div>
                  Contact: <b className="text-foreground">{sup.contactPerson}</b>
                </div>
                <div>
                  Phone: <span className="font-mono">{sup.phone}</span>
                </div>
                <div>Email: {sup.email}</div>
                <div>
                  Delivery:{" "}
                  <span className="font-medium text-foreground">{sup.deliveryDays.join(", ")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
