import React from "react";
import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Search, Plus, FileDown, Trash2, Loader2, Package, ArrowLeft,
  CheckCircle2, Calendar, ShoppingBag, ScanLine, Tag, Sliders,
  Eye, ChevronDown, ChevronUp, TrendingDown, TrendingUp, AlertTriangle,
  BarChart3, ArrowRightLeft, Info
} from "lucide-react";
import { inventoryApi, StockAdjustment as StockAdjustmentType, Warehouse, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface AdjustmentItemInput {
  product_id: string;
  product_name?: string;
  sku?: string;
  current_stock?: number;
  adjustment_type: string;
  quantity_changed: number;
  unit_price: number;
  reason?: string;
}

export function StockAdjustment() {
  const { currency, formatCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [adjustments, setAdjustments] = useState<StockAdjustmentType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productsList, setProductsList] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const [form, setForm] = useState({
    adjustment_number: "",
    warehouse: "",
    adjustment_type: "Write-Off",
    reason: "",
    adjustment_date: new Date().toISOString().slice(0, 10),
  });

  const [items, setItems] = useState<AdjustmentItemInput[]>([]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [res, whs, prods] = await Promise.all([
        inventoryApi.getStockAdjustments(),
        inventoryApi.getWarehouses().catch(() => []),
        inventoryApi.getProducts({ page: 1, page_size: 500 }).then(r => r.items).catch(() => [])
      ]);
      setAdjustments(res);
      setWarehouses(whs);
      setProductsList(prods);
    } catch (error) {
      console.error("Failed to fetch Stock Adjustments:", error);
      toast.error("Failed to load adjustments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreateView = () => {
    const autoNumber = `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    setForm({
      adjustment_number: autoNumber,
      warehouse: warehouses[0]?.name || "Main Warehouse",
      adjustment_type: "Write-Off",
      reason: "",
      adjustment_date: new Date().toISOString().slice(0, 10),
    });
    setItems([]);
    setViewMode("create");
  };

  const addItemRow = (productId?: string) => {
    let initialProd: InventoryProduct | undefined;
    if (productId) {
      initialProd = productsList.find(p => p.id === productId);
    }
    // Prevent duplicates
    if (productId && items.some(i => i.product_id === productId)) {
      toast.info("Product already added. Update the quantity in the existing row.");
      return;
    }
    setItems(prev => [
      ...prev,
      {
        product_id: productId || "",
        product_name: initialProd?.name || "",
        sku: initialProd?.sku || "",
        current_stock: Number(initialProd?.initial_stock || 0),
        adjustment_type: form.adjustment_type || "Write-Off",
        quantity_changed: -1,
        unit_price: Number(initialProd?.purchase_price || initialProd?.mrp) || 0,
        reason: "",
      }
    ]);
  };

  const handleProductSelect = (idx: number, productId: string) => {
    if (items.some((item, i) => i !== idx && item.product_id === productId)) {
      toast.info("Product already in list. Update the existing row.");
      return;
    }
    const selected = productsList.find(p => p.id === productId);
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        product_id: productId,
        product_name: selected?.name || item.product_name,
        sku: selected?.sku || item.sku,
        current_stock: Number(selected?.initial_stock || 0),
        unit_price: Number(selected?.purchase_price || selected?.mrp) || item.unit_price,
      };
    }));
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: keyof AdjustmentItemInput, value: any) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const calculateSubtotal = (item: AdjustmentItemInput) => {
    const qty = Number(item.quantity_changed) || 0;
    const price = Number(item.unit_price) || 0;
    return qty * price;
  };

  const totalQuantityImpact = items.reduce((sum, item) => sum + (Number(item.quantity_changed) || 0), 0);
  const totalValuationImpact = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);
  const writeOffCount = items.filter(i => i.quantity_changed < 0).length;
  const surplusCount = items.filter(i => i.quantity_changed > 0).length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.adjustment_number.trim()) { toast.error("Adjustment number is required"); return; }
    if (items.length === 0) { toast.error("Add at least one product line item"); return; }
    if (items.some((it) => !it.product_id)) { toast.error("Select a product for all line items"); return; }

    setIsSubmitting(true);
    try {
      // Use the batch endpoint for atomic multi-product adjustment
      await inventoryApi.createStockAdjustmentBatch({
        adjustment_number: form.adjustment_number,
        warehouse: form.warehouse,
        adjustment_type: form.adjustment_type,
        reason: form.reason || undefined,
        items: items.map(item => ({
          product_id: item.product_id,
          adjustment_type: item.adjustment_type || form.adjustment_type,
          quantity_changed: Number(item.quantity_changed) || 0,
          reason: item.reason || form.reason || undefined,
          unit_price: item.unit_price || 0,
        })),
      });
      toast.success(`✅ Stock Adjustment ${form.adjustment_number} posted! ${items.length} product(s) updated.`);
      setViewMode("list");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed to post Stock Adjustment: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this adjustment?")) return;
    try {
      await inventoryApi.deleteStockAdjustment(id);
      toast.success("Deleted");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = adjustments.filter((a) => {
    const matchSearch = !search ||
      a.adjustment_number?.toLowerCase().includes(search.toLowerCase()) ||
      a.adjustment_type?.toLowerCase().includes(search.toLowerCase()) ||
      (a.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || a.adjustment_type === filterType;
    return matchSearch && matchType;
  });

  const totalWriteOffs = adjustments.filter(a => a.quantity_changed < 0).length;
  const totalSurplus = adjustments.filter(a => a.quantity_changed > 0).length;
  const totalNetQty = adjustments.reduce((sum, a) => sum + (a.quantity_changed || 0), 0);

  const typeColor = (type: string) => {
    if (type === "Write-Off") return "bg-rose-50 text-rose-700 border-rose-200";
    if (type === "Found") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (type === "Expiry") return "bg-amber-50 text-amber-700 border-amber-200";
    if (type === "Correction") return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  return (
    <div className="space-y-6 pb-12">
      {viewMode === "list" ? (
        <>
          {/* List Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Stock Adjustment & Audit Vouchers</h2>
              <p className="text-sm text-slate-500 mt-1">
                Reconcile physical counts, log write-offs, damages, and audit variances. Every adjustment syncs live to product stock.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="rounded-xl"><FileDown className="size-4 mr-2" /> Export</Button>
              <Button onClick={openCreateView} className="bg-purple-700 hover:bg-purple-800 text-white border-0 shadow-sm rounded-xl font-semibold">
                <Plus className="size-4 mr-2" /> New Stock Adjustment
              </Button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 rounded-2xl border-slate-200 bg-white flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Adjustments</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{adjustments.length}</div>
              </div>
              <div className="size-11 rounded-xl bg-purple-50 text-purple-700 grid place-items-center">
                <BarChart3 className="size-5" />
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border-slate-200 bg-white flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Write-Offs</div>
                <div className="text-2xl font-black text-rose-600 mt-1">{totalWriteOffs}</div>
              </div>
              <div className="size-11 rounded-xl bg-rose-50 text-rose-600 grid place-items-center">
                <TrendingDown className="size-5" />
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border-slate-200 bg-white flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Surplus Found</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{totalSurplus}</div>
              </div>
              <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
                <TrendingUp className="size-5" />
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border-slate-200 bg-white flex items-center justify-between shadow-sm">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Qty Impact</div>
                <div className={`text-2xl font-black mt-1 ${totalNetQty < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {totalNetQty > 0 ? `+${totalNetQty}` : totalNetQty}
                </div>
              </div>
              <div className="size-11 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
                <ArrowRightLeft className="size-5" />
              </div>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Search by Ref #, Product, SKU, or Type..." />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "Write-Off", "Found", "Expiry", "Correction"].map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${filterType === t ? "bg-purple-700 text-white border-purple-700" : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"}`}>
                  {t === "all" ? "All Types" : t}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <Card className="overflow-hidden border-slate-200 shadow-md rounded-2xl">
            <div className="overflow-x-auto min-h-[350px] relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                  <Loader2 className="size-8 animate-spin text-amber-600" />
                </div>
              )}
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-4">Ref / Voucher #</th>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4 text-center">Qty Change</th>
                    <th className="px-5 py-4 text-center">Stock After</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                      No Stock Adjustments found. Click "New Stock Adjustment" to record stock audit variances.
                    </td></tr>
                  )}
                  {filtered.map((adj) => {
                    const isExpanded = expandedId === adj.id;
                    const qtyChanged = adj.quantity_changed || 0;
                    const isNeg = qtyChanged < 0;
                    return (
                      <React.Fragment key={adj.id}>
                        <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? "bg-purple-50/30" : ""}`}>
                          <td className="px-5 py-4 font-mono font-bold text-purple-900 text-xs">{adj.adjustment_number}</td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 text-sm">{adj.product_name || "Unknown Product"}</span>
                              {adj.sku && <span className="text-xs text-slate-400 font-mono">SKU: {adj.sku}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border ${typeColor(adj.adjustment_type)}`}>
                              {isNeg ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
                              {adj.adjustment_type}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`font-black font-mono text-sm ${isNeg ? "text-rose-600" : "text-emerald-600"}`}>
                              {qtyChanged > 0 ? `+${qtyChanged}` : qtyChanged}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {adj.current_stock !== undefined ? (
                              <span className="bg-slate-100 text-slate-700 font-bold text-xs px-2 py-1 rounded-lg">
                                {adj.current_stock} units
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500 max-w-[160px] truncate">{adj.reason || "—"}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="size-3.5" /> {adj.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right space-x-1">
                            <Button variant="outline" size="sm"
                              onClick={() => setExpandedId(prev => prev === adj.id ? null : adj.id)}
                              className={`h-8 gap-1 font-bold rounded-lg ${isExpanded ? "bg-purple-600 text-white border-purple-600" : "hover:bg-purple-50"}`}>
                              <Eye className="size-4" />
                              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(adj.id)} className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={8} className="px-6 py-5 border-b border-purple-100">
                              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Voucher #</div>
                                  <div className="font-mono font-bold text-purple-800">{adj.adjustment_number}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Product</div>
                                  <div className="font-semibold text-slate-800">{adj.product_name || adj.product_id}</div>
                                  {adj.sku && <div className="text-xs text-slate-400 font-mono">SKU: {adj.sku}</div>}
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Adjustment Type</div>
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border ${typeColor(adj.adjustment_type)}`}>
                                    {adj.adjustment_type}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Qty Change</div>
                                  <div className={`font-black text-lg ${isNeg ? "text-rose-600" : "text-emerald-600"}`}>
                                    {qtyChanged > 0 ? `+${qtyChanged}` : qtyChanged} units
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Current Stock After</div>
                                  <div className="font-bold text-slate-800">{adj.current_stock ?? "—"} units</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Reason / Remarks</div>
                                  <div className="text-slate-600">{adj.reason || "Physical count audit variance"}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Status</div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="size-3.5" /> {adj.status}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Date</div>
                                  <div className="text-slate-600">{adj.created_at ? new Date(adj.created_at).toLocaleDateString("en-IN") : "—"}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════ */
        /*  STOCK ADJUSTMENT VOUCHER CREATOR — Multi-product Batch Mode         */
        /* ══════════════════════════════════════════════════════════════════════ */
        <div className="space-y-5">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 lg:p-5 rounded-2xl border shadow-sm">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setViewMode("list")} className="rounded-xl h-10 w-10">
                <ArrowLeft className="size-5 text-slate-600" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-md">
                    New Stock Adjustment Voucher
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Audit Mode</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  {form.adjustment_number}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => setViewMode("list")} className="rounded-xl">Cancel</Button>
              <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="bg-purple-700 hover:bg-purple-800 text-white border-0 shadow-md shadow-purple-500/20 rounded-xl px-6 font-bold">
                {isSubmitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Recording...</> : <><CheckCircle2 className="size-4 mr-2" /> Post Adjustment</>}
              </Button>
            </div>
          </div>

          {/* Voucher Metadata */}
          <Card className="p-5 rounded-2xl border-slate-200 shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-amber-500" /> Voucher #
                </label>
                <input type="text" value={form.adjustment_number} onChange={(e) => setForm({ ...form, adjustment_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sliders className="size-3.5 text-amber-500" /> Default Adjustment Type
                </label>
                <select value={form.adjustment_type} onChange={(e) => setForm({ ...form, adjustment_type: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                  <option value="Write-Off">Write-Off (Damage / Breakage)</option>
                  <option value="Found">Found (Stock Discovery / Surplus)</option>
                  <option value="Expiry">Expired Inventory</option>
                  <option value="Correction">Audit Correction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="size-3.5 text-amber-500" /> Audit Location
                </label>
                <select value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                  {warehouses.length > 0 ? (
                    warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)
                  ) : (
                    <option value="Main Warehouse">Main Warehouse</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-amber-500" /> Adjustment Date
                </label>
                <input type="date" value={form.adjustment_date} onChange={(e) => setForm({ ...form, adjustment_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Overall Audit Reason / Explanation</label>
              <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="e.g. Monthly physical stock audit count discrepancies..." />
            </div>
          </Card>

          {/* Info banner */}
          <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            <Info className="size-4 shrink-0 text-blue-500 mt-0.5" />
            <div>
              <span className="font-bold">Live Stock Sync: </span>
              Posting this adjustment will instantly update each product's current stock level in the system and log an entry in the Stock Movement ledger for full audit traceability.
              Use <span className="font-bold">negative values</span> for write-offs/damage/expiry, and <span className="font-bold">positive values</span> for surplus/found stock.
            </div>
          </div>

          {/* Line-Items Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column: Product Table */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-5 rounded-2xl border-slate-200 shadow-sm bg-white space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="size-4 text-amber-600" /> Adjusted Product Items
                    </h3>
                    <p className="text-xs text-slate-500">Add products. Negative = reduction, Positive = surplus addition.</p>
                  </div>
                  <Button type="button" onClick={() => addItemRow()} className="bg-amber-50 text-amber-600 hover:bg-amber-100 border-0 font-bold text-xs rounded-xl">
                    + Add Product Line
                  </Button>
                </div>

                {/* Barcode / Search */}
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
                  <ProductPicker
                    value=""
                    onChange={(productId) => addItemRow(productId)}
                    placeholder="Scan barcode or search product to add..."
                  />
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-3 py-3">#</th>
                        <th className="px-3 py-3">Product</th>
                        <th className="px-3 py-3 text-center">Current Stock</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3 text-center">Qty Variance</th>
                        <th className="px-3 py-3 text-center">Stock After</th>
                        <th className="px-3 py-3 text-right">Value Impact</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                            No product lines added yet. Use the barcode scanner above or click "+ Add Product Line".
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const subtotal = calculateSubtotal(item);
                          const stockAfter = (item.current_stock || 0) + (Number(item.quantity_changed) || 0);
                          const isNeg = item.quantity_changed < 0;
                          const stockAfterColor = stockAfter < 0 ? "text-rose-600 font-black" : stockAfter === 0 ? "text-amber-600 font-bold" : "text-emerald-700 font-bold";
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-2.5 text-xs font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2.5 min-w-[180px]">
                                <ProductPicker
                                  value={item.product_id}
                                  onChange={(id) => handleProductSelect(idx, id)}
                                  placeholder="Select product..."
                                />
                                {item.sku && <div className="text-xs text-slate-400 font-mono mt-0.5">SKU: {item.sku}</div>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="bg-slate-100 text-slate-700 font-bold text-xs px-2 py-1 rounded-lg">
                                  {item.current_stock ?? "—"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <select value={item.adjustment_type} onChange={(e) => updateItem(idx, "adjustment_type", e.target.value)}
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                                  <option value="Write-Off">Write-Off</option>
                                  <option value="Found">Found</option>
                                  <option value="Expiry">Expiry</option>
                                  <option value="Correction">Correction</option>
                                </select>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  <button type="button"
                                    onClick={() => updateItem(idx, "quantity_changed", (item.quantity_changed || 0) - 1)}
                                    className="size-7 rounded-lg border border-slate-200 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold flex items-center justify-center">−</button>
                                  <input type="number" value={item.quantity_changed}
                                    onChange={(e) => updateItem(idx, "quantity_changed", parseInt(e.target.value) || 0)}
                                    className={`w-16 text-center font-black border border-slate-200 rounded-lg py-1 text-sm outline-none focus:ring-2 focus:ring-amber-500 ${isNeg ? "text-rose-600" : "text-emerald-600"}`} />
                                  <button type="button"
                                    onClick={() => updateItem(idx, "quantity_changed", (item.quantity_changed || 0) + 1)}
                                    className="size-7 rounded-lg border border-slate-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold flex items-center justify-center">+</button>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`text-sm ${stockAfterColor}`}>{stockAfter}</span>
                                {stockAfter < 0 && <div className="text-xs text-rose-500 mt-0.5">⚠ Below zero</div>}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-bold text-sm ${subtotal < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                {formatCurrency(subtotal)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button type="button" onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-rose-600 rounded-lg">
                                  <Trash2 className="size-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Right Column: Audit Summary */}
            <div className="space-y-4">
              <Card className="p-5 rounded-2xl border-slate-200 shadow-md bg-white space-y-4 sticky top-20">
                <h3 className="text-base font-bold text-slate-900 border-b pb-3">Audit Impact Summary</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Adjusted Line Items</span>
                    <span className="font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1"><TrendingDown className="size-3.5 text-rose-500" /> Write-Offs</span>
                    <span className="font-bold text-rose-600">{writeOffCount}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1"><TrendingUp className="size-3.5 text-emerald-500" /> Surplus Added</span>
                    <span className="font-bold text-emerald-600">{surplusCount}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Net Qty Variance</span>
                    <span className={`font-bold ${totalQuantityImpact < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {totalQuantityImpact > 0 ? `+${totalQuantityImpact}` : totalQuantityImpact} Units
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Audit Warehouse</span>
                    <span className="font-semibold text-slate-800 text-xs">{form.warehouse || "—"}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">Net Value Impact</span>
                    <span className={`text-2xl font-black ${totalValuationImpact < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(totalValuationImpact)}
                    </span>
                  </div>
                </div>

                {/* Products preview */}
                {items.length > 0 && (
                  <div className="border-t pt-3 space-y-1.5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Products Being Adjusted</div>
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium truncate max-w-[120px]">{item.product_name || "Select product"}</span>
                        <span className={`font-black ${item.quantity_changed < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {item.quantity_changed > 0 ? `+${item.quantity_changed}` : item.quantity_changed}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-1 space-y-2">
                  <Button type="button" onClick={() => handleSubmit()} disabled={isSubmitting || items.length === 0}
                    className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white border-0 font-bold shadow-md shadow-purple-500/20 rounded-xl text-base">
                    {isSubmitting ? <><Loader2 className="size-5 mr-2 animate-spin" /> Processing...</> : "Post Stock Adjustment"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setViewMode("list")} className="w-full rounded-xl">
                    Back to Adjustment Register
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
