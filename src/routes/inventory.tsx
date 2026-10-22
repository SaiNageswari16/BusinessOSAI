import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, minutesSince } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Ingredient } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  component: InventoryScreen,
});

export function InventoryScreen() {
  const ingredients = useRestaurantStore((s) => s.ingredients);
  const suppliers = useRestaurantStore((s) => s.suppliers);
  const purchaseOrders = useRestaurantStore((s) => s.purchaseOrders);
  const stockMoves = useRestaurantStore((s) => s.stockMoves);

  const createPurchaseOrder = useRestaurantStore((s) => s.createPurchaseOrder);
  const receivePurchaseOrder = useRestaurantStore((s) => s.receivePurchaseOrder);
  const cancelPurchaseOrder = useRestaurantStore((s) => s.cancelPurchaseOrder);
  const adjustIngredientStock = useRestaurantStore((s) => s.adjustIngredientStock);
  const saveSupplier = useRestaurantStore((s) => s.saveSupplier);

  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Stock Adjustment / Wastage Modal
  const [adjustTarget, setAdjustTarget] = useState<Ingredient | null>(null);
  const [adjustMode, setAdjustMode] = useState<"adjustment" | "wastage">("adjustment");
  const [adjustQty, setAdjustQty] = useState<string>("2");
  const [adjustRef, setAdjustRef] = useState<string>("");

  // Create Purchase Order Modal
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState<string>(suppliers[0]?.id ?? "S1");
  const [poIngredientId, setPoIngredientId] = useState<string>(ingredients[0]?.id ?? "I1");
  const [poQty, setPoQty] = useState<string>("10");

  // Add Supplier Modal
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supCategory, setSupCategory] = useState("Dry goods");

  const lowStockList = useMemo(
    () => ingredients.filter((i) => i.stock <= i.reorder),
    [ingredients],
  );

  const totalInventoryValue = useMemo(
    () => ingredients.reduce((sum, i) => sum + i.stock * i.cost, 0),
    [ingredients],
  );

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((i) => {
      if (lowStockOnly && i.stock > i.reorder) return false;
      if (supplierFilter !== "all" && i.supplierId !== supplierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [ingredients, lowStockOnly, supplierFilter, searchQuery]);

  const handleConfirmAdjustment = () => {
    if (!adjustTarget) return;
    const rawQty = Number(adjustQty);
    if (!Number.isFinite(rawQty) || rawQty === 0) {
      toast.error("Enter a valid non-zero quantity");
      return;
    }
    const delta = adjustMode === "wastage" ? -Math.abs(rawQty) : rawQty;
    adjustIngredientStock(
      adjustTarget.id,
      delta,
      adjustMode,
      adjustRef || (adjustMode === "wastage" ? "Kitchen Spoilage/Wastage" : "Manual Audit"),
    );
    toast.success(
      `${adjustMode === "wastage" ? "Recorded wastage" : "Adjusted stock"} for ${adjustTarget.name}`,
    );
    setAdjustTarget(null);
    setAdjustRef("");
  };

  const handleCreatePo = () => {
    const q = Number(poQty);
    if (!poSupplierId || !poIngredientId || !Number.isFinite(q) || q <= 0) {
      toast.error("Select supplier, ingredient, and a positive quantity");
      return;
    }
    const res = createPurchaseOrder(poSupplierId, [{ ingredientId: poIngredientId, qty: q }]);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Created Purchase Order ${res.poId}`);
    setPoModalOpen(false);
  };

  const handleReceivePo = (poId: string) => {
    const res = receivePurchaseOrder(poId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Goods received for ${poId} — stock levels updated!`);
  };

  const handleSaveSupplier = () => {
    if (!supName.trim() || !supPhone.trim()) {
      toast.error("Enter supplier name and phone");
      return;
    }
    saveSupplier({
      name: supName.trim(),
      phone: supPhone.trim(),
      category: supCategory.trim() || "General",
    });
    setSupModalOpen(false);
    setSupName("");
    setSupPhone("");
    toast.success(`Added supplier ${supName}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Inventory & Purchasing"
        title="Inventory, Suppliers & Purchase Orders"
        subtitle="Real-time raw material stock, reorder alerts, goods receipt (GRN), wastage & recipe consumption logs"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSupModalOpen(true)}
              className="gap-1.5"
            >
              <Truck className="h-4 w-4" />
              Add Supplier
            </Button>
            <Button size="sm" onClick={() => setPoModalOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Purchase Order
            </Button>
          </>
        }
      />

      {/* Inventory KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface p-4">
          <div className="text-xs font-medium text-muted-foreground">Total Stock Valuation</div>
          <div className="mt-2 text-2xl font-bold tabular">{inr(totalInventoryValue)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Across {ingredients.length} tracked ingredients
          </div>
        </div>

        <div className="surface p-4">
          <div className="text-xs font-medium text-muted-foreground">Low-Stock Alerts</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular text-destructive">
              {lowStockList.length}
            </span>
            <span className="text-xs text-muted-foreground">at or below reorder</span>
          </div>
          <div className="mt-1 text-xs text-warning font-medium">
            {lowStockList
              .slice(0, 3)
              .map((i) => i.name)
              .join(", ") || "All healthy"}
          </div>
        </div>

        <div className="surface p-4">
          <div className="text-xs font-medium text-muted-foreground">Pending Purchase Orders</div>
          <div className="mt-2 text-2xl font-bold tabular">
            {purchaseOrders.filter((p) => p.status === "pending").length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {purchaseOrders.filter((p) => p.status === "received").length} received GRNs
          </div>
        </div>

        <div className="surface p-4">
          <div className="text-xs font-medium text-muted-foreground">Active Vendors</div>
          <div className="mt-2 text-2xl font-bold tabular">{suppliers.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {stockMoves.length} recorded stock movements
          </div>
        </div>
      </div>

      <Tabs defaultValue="ingredients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ingredients">Ingredients ({ingredients.length})</TabsTrigger>
          <TabsTrigger value="po">Purchase Orders & GRN ({purchaseOrders.length})</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger>
          <TabsTrigger value="ledger">Stock & Recipe Consumption Ledger</TabsTrigger>
        </TabsList>

        {/* TAB 1: INGREDIENTS */}
        <TabsContent value="ingredients" className="space-y-4">
          <div className="surface p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ingredient name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLowStockOnly((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  lowStockOnly
                    ? "border-destructive bg-danger-soft text-destructive"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Low Stock Only ({lowStockList.length})
              </button>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                    <th className="py-3 px-4">Ingredient</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3 text-right">In Stock</th>
                    <th className="py-3 px-3 text-right">Reorder Level</th>
                    <th className="py-3 px-3 text-right">Unit Cost</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredIngredients.map((ing) => {
                    const isLow = ing.stock <= ing.reorder;
                    const sup = suppliers.find((s) => s.id === ing.supplierId);
                    return (
                      <tr key={ing.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-4 font-bold text-foreground">
                          {ing.name}{" "}
                          <span className="ml-1 font-mono text-[10px] font-normal text-muted-foreground">
                            ({ing.id})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {sup?.name ?? ing.supplierId}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 px-3 text-right font-bold tabular",
                            isLow ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {ing.stock} {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular text-muted-foreground">
                          {ing.reorder} {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular">
                          {inr(ing.cost)}/{ing.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          {isLow ? (
                            <Badge
                              variant="outline"
                              className="border-destructive/40 bg-danger-soft text-destructive text-[10px]"
                            >
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-success/40 bg-success-soft text-success text-[10px]"
                            >
                              Healthy
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => {
                                setAdjustTarget(ing);
                                setAdjustMode("adjustment");
                                setAdjustQty("5");
                              }}
                            >
                              Adjust
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px] text-destructive"
                              onClick={() => {
                                setAdjustTarget(ing);
                                setAdjustMode("wastage");
                                setAdjustQty("1");
                              }}
                            >
                              Wastage
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: PURCHASE ORDERS & GOODS RECEIPT */}
        <TabsContent value="po">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {purchaseOrders.map((po) => {
              const sup = suppliers.find((s) => s.id === po.supplierId);
              const totalCost = po.lines.reduce((sum, l) => {
                const ing = ingredients.find((i) => i.id === l.ingredientId);
                return sum + (ing ? ing.cost * l.qty : 0);
              }, 0);

              return (
                <div key={po.id} className="surface p-4 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-sm font-bold text-foreground">{po.id}</span>
                        <div className="text-xs font-medium text-muted-foreground">
                          {sup?.name ?? po.supplierId}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "uppercase text-[10px]",
                          po.status === "received"
                            ? "border-success/40 bg-success-soft text-success"
                            : po.status === "cancelled"
                              ? "border-destructive/40 bg-danger-soft text-destructive"
                              : "border-warning/40 bg-warning-soft text-warning",
                        )}
                      >
                        {po.status}
                      </Badge>
                    </div>

                    <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 px-3 py-1 text-xs">
                      {po.lines.map((line) => {
                        const ing = ingredients.find((i) => i.id === line.ingredientId);
                        return (
                          <div
                            key={line.ingredientId}
                            className="flex items-center justify-between py-1.5"
                          >
                            <span className="font-medium">{ing?.name ?? line.ingredientId}</span>
                            <span className="font-bold tabular">
                              +{line.qty} {ing?.unit ?? "units"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Est. Value: </span>
                      <strong className="tabular">{inr(totalCost)}</strong>
                    </div>

                    {po.status === "pending" && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => {
                            cancelPurchaseOrder(po.id);
                            toast.info(`Cancelled ${po.id}`);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 gap-1 bg-success text-white hover:bg-success/90 text-xs"
                          onClick={() => handleReceivePo(po.id)}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Receive Goods (GRN)
                        </Button>
                      </div>
                    )}
                    {po.status === "received" && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Stock Updated
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 3: SUPPLIERS */}
        <TabsContent value="suppliers">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((sup) => {
              const suppliedCount = ingredients.filter((i) => i.supplierId === sup.id).length;
              return (
                <div key={sup.id} className="surface p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">
                      {sup.category}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{sup.id}</span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{sup.name}</h3>
                  <div className="text-xs text-muted-foreground">{sup.phone}</div>
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Supplies {suppliedCount} ingredients
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setPoSupplierId(sup.id);
                        const firstIng = ingredients.find((i) => i.supplierId === sup.id);
                        if (firstIng) setPoIngredientId(firstIng.id);
                        setPoModalOpen(true);
                      }}
                    >
                      Create PO
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 4: STOCK MOVEMENTS & RECIPE CONSUMPTION LEDGER */}
        <TabsContent value="ledger">
          <div className="surface overflow-hidden">
            {stockMoves.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <ArrowDownUp className="mx-auto mb-2 h-6 w-6 opacity-40" />
                Submit a POS order, receive a Purchase Order, or adjust stock to see live ledger
                entries.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                      <th className="py-3 px-4">Ingredient</th>
                      <th className="py-3 px-3">Movement Type</th>
                      <th className="py-3 px-3">Reference</th>
                      <th className="py-3 px-3 text-right">Quantity Delta</th>
                      <th className="py-3 px-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stockMoves.map((move) => {
                      const ing = ingredients.find((i) => i.id === move.ingredientId);
                      return (
                        <tr key={move.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-4 font-semibold">
                            {ing?.name ?? move.ingredientId}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="uppercase text-[10px]">
                              {move.reason}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {move.ref}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 px-3 text-right font-bold tabular",
                              move.qty > 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {move.qty > 0 ? `+${move.qty}` : move.qty} {ing?.unit ?? ""}
                          </td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground tabular">
                            {minutesSince(move.at)}m ago
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Stock Adjustment / Wastage Dialog */}
      <Dialog
        open={adjustTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {adjustMode === "wastage" ? "Record Wastage" : "Stock Adjustment"} —{" "}
              {adjustTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Current stock: {adjustTarget?.stock} {adjustTarget?.unit} (Reorder:{" "}
              {adjustTarget?.reorder} {adjustTarget?.unit})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">
                {adjustMode === "wastage"
                  ? `Wastage Quantity to Deduct (${adjustTarget?.unit})`
                  : `Quantity Delta (+ to add, - to deduct ${adjustTarget?.unit})`}
              </Label>
              <Input
                type="number"
                step="0.5"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason / Reference Note</Label>
              <Input
                value={adjustRef}
                onChange={(e) => setAdjustRef(e.target.value)}
                placeholder={
                  adjustMode === "wastage" ? "e.g. Expired batch" : "e.g. Physical stock count"
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmAdjustment}>
              Confirm {adjustMode === "wastage" ? "Wastage" : "Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Purchase Order Dialog */}
      <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Order raw ingredients from approved suppliers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Supplier</Label>
              <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ingredient</Label>
              <Select value={poIngredientId} onValueChange={setPoIngredientId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} (Stock: {i.stock} {i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Order Quantity</Label>
              <Input
                type="number"
                value={poQty}
                onChange={(e) => setPoQty(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPoModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreatePo}>
              Issue Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Supplier Dialog */}
      <Dialog open={supModalOpen} onOpenChange={setSupModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Register Supplier</DialogTitle>
            <DialogDescription>Add a new vendor to the purchasing directory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Vendor Name</Label>
              <Input
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                placeholder="e.g. Nizamabad Agro Foods"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                placeholder="+91 98480 99887"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Supply Category</Label>
              <Input
                value={supCategory}
                onChange={(e) => setSupCategory(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSupModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveSupplier}>
              Save Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
