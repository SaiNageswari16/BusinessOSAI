import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Clock,
  History,
  Layers,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Wine,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  autoGenerateCriticalPOs,
  receivePurchaseOrder,
  usePurchaseOrders,
  useSuppliers,
} from "@/services/orderService";
import {
  GlobalInventoryOverview,
  GlobalItemRollup,
  inventoryService,
  StockMovement,
  StorageLocation,
} from "@/services/inventoryService";
import { compactMoney, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Global & Restaurant Inventory — RestaurantOS" },
      {
        name: "description",
        content:
          "Enterprise Master Global Inventory linked with Module Sub-Inventories (Kitchen & Bar stores), internal replenishment transfers, and real-time ledger tracking.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const purchaseOrders = usePurchaseOrders();
  const suppliers = useSuppliers();

  // Active Top-Level View Tab
  const [activeTab, setActiveTab] = useState<
    "global" | "restaurant" | "bar" | "transfers" | "pos" | "suppliers"
  >("global");

  // Filter state
  const [statusFilter, setStatusFilter] = useState<"All" | "Critical" | "Low" | "OK">("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Real backend data states
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<GlobalInventoryOverview | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Internal Stock Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [sourceLocId, setSourceLocId] = useState<string>("");
  const [destLocId, setDestLocId] = useState<string>("");
  const [transferQty, setTransferQty] = useState<string>("5");
  const [transferNotes, setTransferNotes] = useState<string>("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // New Master Item Modal State
  const [createItemModalOpen, setCreateItemModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCode, setNewItemCode] = useState("");
  const [newItemCost, setNewItemCost] = useState("50");
  const [newItemReorder, setNewItemReorder] = useState("10");
  const [newOpeningQty, setNewOpeningQty] = useState("100");
  const [createItemSubmitting, setCreateItemSubmitting] = useState(false);

  // Direct Stock Adjust State per row
  const [adjustInputs, setAdjustInputs] = useState<Record<string, string>>({});

  // Load real data from Gateway (:8000 /api/v1/inventory/*)
  const loadInventoryData = async () => {
    try {
      setLoading(true);
      // 1. Fetch locations
      let locs = await inventoryService.getLocations();
      if (!locs || locs.length === 0) {
        // Auto-bootstrap default central warehouse + restaurant & bar stores
        locs = await inventoryService.bootstrapLocations("00000000-0000-0000-0000-000000000000");
      }
      setLocations(locs);

      // Set default transfer locations if available
      const central = locs.find((l) => l.is_central || l.module === "central") || locs[0];
      const rest = locs.find((l) => l.module === "restaurant") || locs[1] || locs[0];
      if (central) setSourceLocId(central.id);
      if (rest) setDestLocId(rest.id);

      // 2. Fetch global rollup overview
      const data = await inventoryService.getGlobalRollup();
      setOverview(data);

      // 3. Fetch recent stock movements
      const movs = await inventoryService.getMovements({ limit: 50 });
      setMovements(movs);
    } catch (err: any) {
      console.error("Failed to load inventory data:", err);
      toast.error("Failed to sync inventory with backend", {
        description: err.message || "Please check backend connection",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, []);

  // Filter items based on active module tab, search query, and status
  const allItems: GlobalItemRollup[] = overview?.items || [];

  const filteredItems = allItems.filter((item) => {
    // 1. Status Filter
    if (statusFilter !== "All" && item.stock_status !== statusFilter) {
      return false;
    }

    // 2. Search Query Filter
    if (
      searchQuery &&
      !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.code.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // 3. Module Sub-Inventory View Filter
    if (activeTab === "restaurant") {
      const restStock = item.module_stocks.find((m) => m.module === "restaurant");
      return (restStock?.qty_on_hand || 0) > 0 || (restStock?.qty_available || 0) > 0;
    }
    if (activeTab === "bar") {
      const barStock = item.module_stocks.find((m) => m.module === "bar");
      return (barStock?.qty_on_hand || 0) > 0 || (barStock?.qty_available || 0) > 0;
    }

    return true;
  });

  // Handle Internal Stock Transfer (Replenishment)
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !sourceLocId || !destLocId) {
      toast.error("Please select an item, source warehouse, and destination store");
      return;
    }
    const qty = parseFloat(transferQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid transfer quantity greater than 0");
      return;
    }

    try {
      setTransferSubmitting(true);
      const res = await inventoryService.transferStock({
        outlet_id: "00000000-0000-0000-0000-000000000000",
        inventory_item_id: selectedItemId,
        source_location_id: sourceLocId,
        destination_location_id: destLocId,
        qty,
        notes: transferNotes || "Inter-module stock replenishment",
      });

      toast.success("Stock Replenished Successfully!", {
        description: `Transferred ${qty} units of ${res.item_name} from ${res.source_location_name} to ${res.destination_location_name}.`,
      });

      setTransferModalOpen(false);
      setTransferNotes("");
      await loadInventoryData();
    } catch (err: any) {
      console.error("Transfer failed:", err);
      toast.error("Stock Transfer Failed", {
        description: err.message || "Insufficient stock or invalid location",
      });
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Handle Creating New Master Item
  const handleCreateMasterItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemCode.trim()) {
      toast.error("Please provide both item name and code");
      return;
    }

    try {
      setCreateItemSubmitting(true);
      const central = locations.find((l) => l.is_central || l.module === "central") || locations[0];
      const created = await inventoryService.createItem({
        name: newItemName.trim(),
        code: newItemCode.trim(),
        item_type: "ingredient",
        standard_cost: parseFloat(newItemCost) || 0,
        reorder_level: parseFloat(newItemReorder) || 0,
        default_location_id: central?.id,
      });

      // Record opening stock in Central Warehouse
      const openQty = parseFloat(newOpeningQty);
      if (openQty > 0 && central) {
        await inventoryService.setOpeningStock(
          created.id,
          "00000000-0000-0000-0000-000000000000",
          {
            qty: openQty,
            unit_cost: parseFloat(newItemCost) || 0,
            location_id: central.id,
          }
        );
      }

      toast.success(`Created "${created.name}" in Global Master Catalog!`, {
        description: `Opening stock of ${openQty} units loaded in ${central?.name || "Central Hub"}.`,
      });

      setCreateItemModalOpen(false);
      setNewItemName("");
      setNewItemCode("");
      await loadInventoryData();
    } catch (err: any) {
      console.error("Failed to create master item:", err);
      toast.error("Item creation failed", {
        description: err.message || "Error saving item to database",
      });
    } finally {
      setCreateItemSubmitting(false);
    }
  };

  // Quick count adjust on row
  const handleQuickAdjust = async (item: GlobalItemRollup) => {
    const val = parseFloat(adjustInputs[item.id] || "");
    if (isNaN(val) || val === 0) return;

    try {
      const central = locations.find((l) => l.is_central || l.module === "central") || locations[0];
      const newCount = Math.max(0, item.total_global_on_hand + val);

      await inventoryService.adjustStock({
        item_id: item.id,
        outlet_id: "00000000-0000-0000-0000-000000000000",
        counted_qty: newCount,
        location_id: central?.id,
        reason: val > 0 ? "Manual restock received" : "Variance / recount adjustment",
      });

      setAdjustInputs((prev) => ({ ...prev, [item.id]: "" }));
      toast.success(`Adjusted ${item.name} by ${val > 0 ? `+${val}` : val} units`);
      await loadInventoryData();
    } catch (err: any) {
      toast.error("Adjustment failed", { description: err.message });
    }
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

  // Helper to get stock for a specific module
  const getModuleStock = (item: GlobalItemRollup, moduleName: string) => {
    return item.module_stocks.find((m) => m.module === moduleName);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Enterprise Supply Chain & Logistics"
        title="Global Master & Module Inventory"
        description="Unified central warehouse distribution linked to Restaurant Kitchen and Bar sub-inventories with real-time bidirectional transfers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadInventoryData}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Sync
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const central = locations.find((l) => l.is_central || l.module === "central");
                const rest = locations.find((l) => l.module === "restaurant");
                if (central) setSourceLocId(central.id);
                if (rest) setDestLocId(rest.id);
                if (allItems.length > 0) setSelectedItemId(allItems[0].id);
                setTransferModalOpen(true);
              }}
              className="gap-1.5 border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <ArrowRightLeft className="size-3.5" />
              Replenish Kitchen / Transfer
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setNewItemCode(`ING-${Math.floor(1000 + Math.random() * 9000)}`);
                setCreateItemModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              New Master Item
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Global Stock Value"
          value={compactMoney(overview?.total_value || 0)}
          sub={`Central Hub: ${compactMoney(overview?.central_warehouse_value || 0)}`}
        />
        <KpiCard
          label="Kitchen Store Value"
          value={compactMoney(overview?.module_values?.["restaurant"] || 0)}
          sub="Restaurant active prep stock"
        />
        <KpiCard
          label="Critical Low Items"
          value={String(overview?.critical_stock_count || 0)}
          sub="Requires central replenishment"
        />
        <KpiCard
          label="Active POs"
          value={String(purchaseOrders.filter((p) => p.status !== "Received").length)}
          sub={`${suppliers.length} active suppliers`}
        />
      </div>

      {/* View Tabs Selector */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab("global")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              activeTab === "global"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Warehouse className="size-3.5" />
            Global Master Catalog ({allItems.length})
          </button>

          <button
            onClick={() => setActiveTab("restaurant")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              activeTab === "restaurant"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <UtensilsCrossed className="size-3.5" />
            Restaurant Kitchen Store
          </button>

          <button
            onClick={() => setActiveTab("bar")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              activeTab === "bar"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Wine className="size-3.5" />
            Bar & Beverage Store
          </button>

          <button
            onClick={() => setActiveTab("transfers")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              activeTab === "transfers"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <History className="size-3.5" />
            Stock Ledger & Transfers ({movements.length})
          </button>

          <button
            onClick={() => setActiveTab("pos")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              activeTab === "pos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <PackageCheck className="size-3.5" />
            Purchase Orders ({purchaseOrders.length})
          </button>

          <button
            onClick={() => setActiveTab("suppliers")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              activeTab === "suppliers"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Truck className="size-3.5" />
            Suppliers ({suppliers.length})
          </button>
        </div>

        {activeTab === "pos" && (
          <Button size="sm" onClick={handleAutoPOs} className="gap-1.5 text-xs">
            <Plus className="size-3.5" /> Auto-generate POs
          </Button>
        )}
      </div>

      {/* Notification banner explaining real-time linking */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="space-y-0.5">
          <p className="font-semibold text-primary">
            Hub & Spoke Master Architecture Active
          </p>
          <p className="text-muted-foreground">
            The <b>Global Central Warehouse</b> holds master inventory bulk stocks. The{" "}
            <b>Restaurant Kitchen Store</b> and <b>Bar Store</b> operate as specialized module
            sub-inventories linked directly to the main warehouse. Restaurant POS orders consume
            ingredients directly from the Kitchen Store; low stocks can be replenished via internal
            transfers with zero lag.
          </p>
        </div>
      </div>

      {/* Main Table Views (Global, Restaurant, Bar) */}
      {(activeTab === "global" || activeTab === "restaurant" || activeTab === "bar") && (
        <Panel bodyClass="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            {(["All", "Critical", "Low", "OK"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                {s}
              </button>
            ))}

            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ingredient or code..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item & SKU</th>
                  <th className="font-medium">Total Global Stock</th>
                  <th className="font-medium">Central Warehouse</th>
                  <th className="font-medium">Restaurant Kitchen</th>
                  <th className="font-medium">Bar Store</th>
                  <th className="text-right font-medium">Std Cost</th>
                  <th className="px-4 font-medium">Status</th>
                  <th className="px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      No inventory items found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const restStock = getModuleStock(item, "restaurant");
                    const barStock = getModuleStock(item, "bar");

                    return (
                      <tr key={item.id} className="hover:bg-muted/40 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {item.code} {item.sku ? `· ${item.sku}` : ""}
                          </div>
                        </td>

                        <td className="tabular font-mono text-xs">
                          <div className="font-semibold text-foreground">
                            {item.total_global_on_hand} units
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Avail: {item.total_global_available}
                          </div>
                        </td>

                        <td className="tabular font-mono text-xs">
                          <span className="rounded bg-sky-50 px-2 py-0.5 font-medium text-sky-700 border border-sky-200">
                            {item.central_warehouse_on_hand}
                          </span>
                        </td>

                        <td className="tabular font-mono text-xs">
                          <span className="rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-200">
                            {restStock?.qty_on_hand || 0}
                          </span>
                        </td>

                        <td className="tabular font-mono text-xs">
                          <span className="rounded bg-purple-50 px-2 py-0.5 font-medium text-purple-700 border border-purple-200">
                            {barStock?.qty_on_hand || 0}
                          </span>
                        </td>

                        <td className="text-right tabular font-mono text-xs font-medium">
                          {money(item.standard_cost)}
                        </td>

                        <td className="px-4">
                          <StatusBadge
                            status={item.stock_status}
                            tone={
                              item.stock_status === "Critical"
                                ? "critical"
                                : item.stock_status === "Low"
                                ? "warning"
                                : "success"
                            }
                          />
                        </td>

                        <td className="px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => {
                                setSelectedItemId(item.id);
                                const central = locations.find(
                                  (l) => l.is_central || l.module === "central"
                                );
                                const rest = locations.find((l) => l.module === "restaurant");
                                if (central) setSourceLocId(central.id);
                                if (rest) setDestLocId(rest.id);
                                setTransferModalOpen(true);
                              }}
                            >
                              <ArrowRightLeft className="size-3" />
                              Replenish
                            </Button>

                            <form
                              className="flex gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleQuickAdjust(item);
                              }}
                            >
                              <Input
                                value={adjustInputs[item.id] ?? ""}
                                onChange={(e) =>
                                  setAdjustInputs((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                placeholder="±qty"
                                className="h-7 w-16 text-xs font-mono"
                                type="number"
                              />
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                Adjust
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Stock Ledger & Inter-Module Transfers View */}
      {activeTab === "transfers" && (
        <Panel title="Stock Movements & Replenishment Ledger" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Timestamp</th>
                  <th className="font-medium">Type</th>
                  <th className="font-medium">Quantity</th>
                  <th className="font-medium">Reference</th>
                  <th className="font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/40 transition">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </td>

                      <td>
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                            m.movement_type === "transfer_in"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : m.movement_type === "transfer_out"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : m.movement_type === "consumption"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : m.movement_type === "wastage"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-50 text-slate-700 border border-slate-200"
                          )}
                        >
                          {m.movement_type.replace("_", " ")}
                        </span>
                      </td>

                      <td className="tabular font-mono text-xs font-semibold">
                        <span className={m.qty > 0 ? "text-success" : "text-critical"}>
                          {m.qty > 0 ? `+${m.qty}` : m.qty} units
                        </span>
                      </td>

                      <td className="font-mono text-xs text-muted-foreground">
                        {m.reference_id || m.reference_type || "Direct adjustment"}
                      </td>

                      <td className="text-xs text-muted-foreground">{m.notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Purchase Orders Tab */}
      {activeTab === "pos" && (
        <Panel title="Purchase Orders & Goods Receipt" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">PO Number</th>
                  <th className="font-medium">Supplier</th>
                  <th className="font-medium">Items included</th>
                  <th className="text-right font-medium">Order value</th>
                  <th className="font-medium pl-4">Status</th>
                  <th className="px-4 text-right font-medium">Goods receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-muted/40 transition">
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

      {/* Suppliers Tab */}
      {activeTab === "suppliers" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((sup) => (
            <div key={sup.id} className="rounded-lg border bg-card p-4 space-y-2 shadow-sm">
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Internal Stock Transfer & Replenish Kitchen Sub-Inventory
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-primary" />
              Replenish Module Sub-Inventory
            </DialogTitle>
            <DialogDescription>
              Transfer stock from the <b>Global Central Warehouse</b> directly into the{" "}
              <b>Restaurant Kitchen Store</b> or <b>Bar Store</b>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteTransfer} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Select Ingredient / Item</label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose inventory item..." />
                </SelectTrigger>
                <SelectContent>
                  {allItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.code}) — Central Stock: {item.central_warehouse_on_hand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Source Warehouse</label>
                <Select value={sourceLocId} onValueChange={setSourceLocId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Destination Sub-Store</label>
                <Select value={destLocId} onValueChange={setDestLocId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Transfer Quantity (Units)</label>
              <Input
                type="number"
                step="0.01"
                min="0.1"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                placeholder="Quantity to transfer..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Transfer Purpose / Notes</label>
              <Input
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="e.g. Daily morning kitchen prep replenishment"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransferModalOpen(false)}
                disabled={transferSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={transferSubmitting} className="gap-1.5">
                <ArrowRightLeft className="size-4" />
                {transferSubmitting ? "Executing Transfer..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Create New Master Item in Global Catalog
          ───────────────────────────────────────────────────────────── */}
      <Dialog open={createItemModalOpen} onOpenChange={setCreateItemModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Add Item to Master Catalog
            </DialogTitle>
            <DialogDescription>
              Register a new ingredient or beverage in the Global Master Inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMasterItem} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Item Name</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Buffalo Mozzarella Cheese"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Item Code / SKU</label>
                <Input
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  placeholder="ING-4091"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Standard Cost (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItemCost}
                  onChange={(e) => setNewItemCost(e.target.value)}
                  placeholder="50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Reorder Level (Par)</label>
                <Input
                  type="number"
                  value={newItemReorder}
                  onChange={(e) => setNewItemReorder(e.target.value)}
                  placeholder="10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Opening Central Stock</label>
                <Input
                  type="number"
                  value={newOpeningQty}
                  onChange={(e) => setNewOpeningQty(e.target.value)}
                  placeholder="100"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateItemModalOpen(false)}
                disabled={createItemSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createItemSubmitting} className="gap-1.5">
                <Package className="size-4" />
                {createItemSubmitting ? "Creating..." : "Save Master Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
