import React from "react";
import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Search, Plus, FileDown, Trash2, Loader2, Package, ArrowLeft, 
  CheckCircle2, Building2, Calendar, FileText, ShoppingBag, PlusCircle, MinusCircle, ScanLine, Tag, Sliders, AlertTriangle, Eye, ChevronDown, ChevronUp, Printer
} from "lucide-react";
import { inventoryApi, StockAdjustment as StockAdjustmentType, Warehouse, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface AdjustmentItemInput {
  product_id: string;
  product_name?: string;
  sku?: string;
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
        inventoryApi.getProducts({ page: 1, page_size: 200 }).then(r => r.items).catch(() => [])
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
    setItems(prev => [
      ...prev,
      {
        product_id: productId || "",
        product_name: initialProd?.name || "",
        sku: initialProd?.sku || "",
        adjustment_type: form.adjustment_type || "Write-Off",
        quantity_changed: -1,
        unit_price: Number(initialProd?.purchase_price || initialProd?.mrp) || 0,
        reason: "",
      }
    ]);
  };

  const handleProductSelect = (idx: number, productId: string) => {
    const selected = productsList.find(p => p.id === productId);
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        product_id: productId,
        product_name: selected?.name || item.product_name,
        sku: selected?.sku || item.sku,
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.adjustment_number.trim()) { toast.error("Adjustment number is required"); return; }
    if (items.length === 0) { toast.error("Add at least one product line item"); return; }
    if (items.some((it) => !it.product_id)) { toast.error("Select a product for all line items"); return; }

    setIsSubmitting(true);
    try {
      // Post line by line for full backward compatibility with backend adjustment endpoints
      for (const item of items) {
        await inventoryApi.createStockAdjustment({
          adjustment_number: form.adjustment_number,
          product_id: item.product_id,
          adjustment_type: item.adjustment_type || form.adjustment_type,
          quantity_changed: Number(item.quantity_changed) || 0,
          reason: item.reason || form.reason || undefined,
          status: "Completed",
        });
      }
      toast.success("Stock Adjustment voucher successfully posted!");
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

  const filtered = adjustments.filter((a) =>
    !search || a.adjustment_number.toLowerCase().includes(search.toLowerCase()) || a.adjustment_type.toLowerCase().includes(search.toLowerCase())
  );

  const qtyColor = (q: number) => q < 0 ? "text-rose-600 bg-rose-50" : "text-emerald-600 bg-emerald-50";
  const qtyPrefix = (q: number) => q < 0 ? "" : "+";

  return (
    <div className="space-y-5 pb-12">
      {viewMode === "list" ? (
        <>
          {/* ── Page Header ── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none">
                  Stock Adjustments
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                  {adjustments.length} Vouchers
                </span>
              </div>
              <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-normal">
                Reconcile physical stock counts, log inventory write-offs, damages, and audit variances.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                className="h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
                onClick={() => toast.info("Exporting stock adjustments report...")}
              >
                <FileDown className="size-3.5 mr-1.5 text-slate-500" /> Export
              </Button>
              <Button 
                size="sm"
                onClick={openCreateView} 
                className="h-9 px-3.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Plus className="size-4 mr-1.5" /> New Stock Adjustment
              </Button>
            </div>
          </div>

          {/* ── Search & Filters Bar ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50/80 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium" 
                placeholder="Search by Ref #, Adjustment Type, or Reason..." 
              />
            </div>
          </div>

          {/* ── Table Section ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
              <Loader2 className="size-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-semibold text-slate-600">Loading stock adjustments...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-14 border border-dashed rounded-2xl bg-slate-50/50">
              <Sliders className="size-12 mx-auto text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Stock Adjustments found</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">Click 'New Stock Adjustment' to record stock audit variances.</p>
              <Button onClick={openCreateView} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg h-9">
                <Plus className="size-4 mr-1.5" /> New Stock Adjustment
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
                    <tr>
                      <th className="px-4 py-3">Ref Number</th>
                      <th className="px-4 py-3">Adjustment Type</th>
                      <th className="px-4 py-3">Qty Variance</th>
                      <th className="px-4 py-3">Reason / Remarks</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((adj) => {
                      const isExpanded = expandedId === adj.id;
                      return (
                        <tr 
                          key={adj.id} 
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => {
                            setForm({
                              adjustment_number: adj.adjustment_number,
                              warehouse: (adj as any).warehouse_id || "",
                              adjustment_type: adj.adjustment_type || "Write-Off",
                              reason: adj.reason || "",
                              adjustment_date: adj.created_at ? adj.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                            });
                            if (adj.items && adj.items.length > 0) {
                              setItems(adj.items.map((it: any) => ({
                                product_id: it.product_id,
                                product_name: it.product_name,
                                adjustment_type: adj.adjustment_type || "Write-Off",
                                quantity_changed: Number(it.quantity_changed) || 1,
                                unit_price: Number(it.unit_price) || 0,
                                reason: adj.reason || ""
                              })));
                            }
                            setViewMode("create");
                          }}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                            <div>{adj.adjustment_number}</div>
                            <div className="text-[10.5px] font-normal text-slate-400 font-sans mt-0.5">
                              {adj.created_at ? new Date(adj.created_at).toLocaleDateString() : "Today"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                              {adj.adjustment_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-black">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${qtyColor(adj.quantity_changed)}`}>
                              {qtyPrefix(adj.quantity_changed)}{adj.quantity_changed} Units
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate font-medium">
                            {adj.reason || "Audit adjustment"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              adj.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80" : "bg-amber-50 text-amber-700 border border-amber-200/80"
                            }`}>
                              <CheckCircle2 className="size-3" /> {adj.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setForm({
                                    adjustment_number: adj.adjustment_number,
                                    warehouse: (adj as any).warehouse_id || "",
                                    adjustment_type: adj.adjustment_type || "Write-Off",
                                    reason: adj.reason || "",
                                    adjustment_date: adj.created_at ? adj.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                                  });
                                  if (adj.items && adj.items.length > 0) {
                                    setItems(adj.items.map((it: any) => ({
                                      product_id: it.product_id,
                                      product_name: it.product_name,
                                      adjustment_type: adj.adjustment_type || "Write-Off",
                                      quantity_changed: Number(it.quantity_changed) || 1,
                                      unit_price: Number(it.unit_price) || 0,
                                      reason: adj.reason || ""
                                    })));
                                  }
                                  setViewMode("create");
                                }}
                                className="size-8 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition cursor-pointer"
                                title="View / Edit Adjustment"
                              >
                                <Eye className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(adj.id)}
                                className="size-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                                title="Delete Adjustment"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Showing {filtered.length} of {adjustments.length} adjustment records</span>
                <span className="font-semibold text-slate-700">Click any row to view voucher details</span>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════ */
        /*  DEDICATED SALES-STYLE STOCK ADJUSTMENT DOCUMENT CREATOR              */
        /* ══════════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {/* Top Navigation & Status Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 lg:p-6 rounded-2xl border shadow-sm">
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
              <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white border-0 shadow-lg shadow-amber-500/20 rounded-xl px-6 font-bold">
                {isSubmitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Recording...</> : <><CheckCircle2 className="size-4 mr-2" /> Post Adjustment</>}
              </Button>
            </div>
          </div>

          {/* Document Header Metadata Form */}
          <Card className="p-6 rounded-2xl border-slate-200 shadow-sm bg-white">
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
                  <Calendar className="size-3.5 text-amber-500" /> Audit Location
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
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" placeholder="e.g. Monthly physical stock audit count discrepancies..." />
            </div>
          </Card>

          {/* Line-Items Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Product Table */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6 rounded-2xl border-slate-200 shadow-sm bg-white space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="size-4 text-amber-600" /> Adjusted Product Items
                    </h3>
                    <p className="text-xs text-slate-500">Add products to adjust. Use negative values for reductions and positive values for surplus additions.</p>
                  </div>
                  <Button type="button" onClick={() => addItemRow()} className="bg-amber-50 text-amber-600 hover:bg-amber-100 border-0 font-bold text-xs rounded-xl">
                    + Add Product Line
                  </Button>
                </div>

                {/* Scannable Barcode Product Search */}
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
                  <ProductPicker 
                    value="" 
                    onChange={(productId) => addItemRow(productId)} 
                    placeholder="Scan product barcode or search by name to adjust..." 
                  />
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Product Item</th>
                        <th className="px-4 py-3">Adjustment Type</th>
                        <th className="px-4 py-3 text-center">Qty Variance</th>
                        <th className="px-4 py-3 text-right">Valuation Impact ({currency.symbol})</th>
                        <th className="px-3 py-3 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                            No product line items added yet. Use the barcode search above or click "+ Add Product Line".
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const subtotal = calculateSubtotal(item);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-xs font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3 min-w-[180px]">
                                <ProductPicker 
                                  value={item.product_id} 
                                  onChange={(id) => handleProductSelect(idx, id)} 
                                  placeholder="Select product..." 
                                />
                              </td>
                              <td className="px-4 py-3">
                                <select value={item.adjustment_type} onChange={(e) => updateItem(idx, "adjustment_type", e.target.value)}
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                                  <option value="Write-Off">Write-Off</option>
                                  <option value="Found">Found</option>
                                  <option value="Expiry">Expiry</option>
                                  <option value="Correction">Correction</option>
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <input type="number" value={item.quantity_changed}
                                    onChange={(e) => updateItem(idx, "quantity_changed", parseInt(e.target.value) || 0)}
                                    className="w-20 text-center font-bold border border-slate-200 rounded-lg py-1 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                                </div>
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${subtotal < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                {formatCurrency(subtotal)}
                              </td>
                              <td className="px-3 py-3 text-center">
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

            {/* Right Column: Audit Summary Card */}
            <div className="space-y-4">
              <Card className="p-6 rounded-2xl border-slate-200 shadow-md bg-white space-y-5 sticky top-20">
                <h3 className="text-base font-bold text-slate-900 border-b pb-3">Audit Impact Summary</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Adjusted Line Items</span>
                    <span className="font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Net Qty Variance</span>
                    <span className={`font-bold ${totalQuantityImpact < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {totalQuantityImpact > 0 ? `+${totalQuantityImpact}` : totalQuantityImpact} Units
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Audit Warehouse</span>
                    <span className="font-semibold text-slate-800">{form.warehouse}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">Net Value Impact</span>
                    <span className={`text-2xl font-black ${totalValuationImpact < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(totalValuationImpact)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button type="button" onClick={() => handleSubmit()} disabled={isSubmitting || items.length === 0}
                    className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white border-0 font-bold shadow-lg shadow-amber-500/20 rounded-xl text-base">
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
