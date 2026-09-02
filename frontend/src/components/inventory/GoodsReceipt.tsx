import React, { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Search, Plus, FileDown, Trash2, Loader2, Package, ArrowLeft, 
  CheckCircle2, Building2, Calendar, FileText, ShoppingBag, PlusCircle, MinusCircle, 
  ScanLine, Tag, Eye, Edit3, ChevronDown, ChevronUp, Printer, Layers, X, CheckSquare, Square
} from "lucide-react";
import { inventoryApi, GoodsReceipt as GoodsReceiptType, Warehouse, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface ReceiptItemInput {
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity_received: number;
  unit_price: number;
  tax_percent?: number;
}

export function GoodsReceipt() {
  const { currency, formatCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [editingGrnId, setEditingGrnId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<GoodsReceiptType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productsList, setProductsList] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Batch Multi-Product Selection Modal State
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [multiSearch, setMultiSearch] = useState("");
  const [multiCategory, setMultiCategory] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    receipt_number: "",
    supplier: "",
    reference_number: "",
    warehouse: "",
    notes: "",
    received_date: new Date().toISOString().slice(0, 10),
  });

  const [items, setItems] = useState<ReceiptItemInput[]>([]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const [res, whs, prods] = await Promise.all([
        inventoryApi.getGoodsReceipts(),
        inventoryApi.getWarehouses().catch(() => []),
        inventoryApi.getProducts({ page: 1, page_size: 500 }).then(r => r.items).catch(() => [])
      ]);
      setReceipts(res || []);
      setWarehouses(whs || []);
      setProductsList(prods || []);
    } catch (error) {
      console.error("Failed to fetch GRNs:", error);
      toast.error("Failed to load Goods Receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReceipts(); }, []);

  const openCreateView = () => {
    const autoNumber = `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const defaultStore = warehouses.find(w => w.is_primary)?.name || warehouses[0]?.name || "Main Store";
    setEditingGrnId(null);
    setForm({
      receipt_number: autoNumber,
      supplier: "",
      reference_number: "",
      warehouse: defaultStore,
      notes: "",
      received_date: new Date().toISOString().slice(0, 10),
    });
    setItems([]);
    setViewMode("create");
  };

  const openEditView = (grn: GoodsReceiptType) => {
    setEditingGrnId(grn.id);
    setForm({
      receipt_number: grn.receipt_number,
      supplier: grn.supplier || "",
      reference_number: grn.reference_number || "",
      warehouse: (grn as any).warehouse_id || (grn as any).warehouse || warehouses[0]?.name || "Main Store",
      notes: (grn as any).notes || "",
      received_date: (grn as any).created_at ? (grn as any).created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    if (grn.items && grn.items.length > 0) {
      setItems(grn.items.map((it: any) => ({
        product_id: it.product_id,
        product_name: it.product_name || productsList.find(p => p.id === it.product_id)?.name || "",
        sku: it.sku || productsList.find(p => p.id === it.product_id)?.sku || "",
        quantity_received: Number(it.quantity_received) || 1,
        unit_price: Number(it.unit_price) || 0,
        tax_percent: 18
      })));
    } else {
      setItems([]);
    }
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
        quantity_received: 1,
        unit_price: Number(initialProd?.purchase_price) || 0,
        tax_percent: Number(initialProd?.tax_percent) || 18,
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
        unit_price: Number(selected?.purchase_price) || item.unit_price,
        tax_percent: Number(selected?.tax_percent) || item.tax_percent || 18,
      };
    }));
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: keyof ReceiptItemInput, value: any) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const calculateSubtotal = (item: ReceiptItemInput) => {
    const qty = Number(item.quantity_received) || 0;
    const price = Number(item.unit_price) || 0;
    return qty * price;
  };

  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity_received) || 0), 0);
  const totalValuation = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);

  // Multi-Product Batch Modal Helpers
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    productsList.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [productsList]);

  const filteredMultiProducts = useMemo(() => {
    const q = multiSearch.trim().toLowerCase();
    return productsList.filter(p => {
      const matchCat = !multiCategory || p.category === multiCategory;
      const matchQuery = !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.barcode && p.barcode.includes(q));
      return matchCat && matchQuery;
    });
  }, [productsList, multiSearch, multiCategory]);

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedProductIds(new Set(filteredMultiProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProductIds(new Set());
  };

  const handleAddSelectedProducts = () => {
    const prodsToAdd = productsList.filter(p => selectedProductIds.has(p.id));
    const newItems: ReceiptItemInput[] = prodsToAdd.map(p => ({
      product_id: p.id,
      product_name: p.name,
      sku: p.sku || "",
      quantity_received: 1,
      unit_price: Number(p.purchase_price) || 0,
      tax_percent: Number(p.tax_percent) || 18,
    }));

    setItems(prev => {
      const existingIds = new Set(prev.map(it => it.product_id).filter(Boolean));
      const nonDuplicate = newItems.filter(it => !existingIds.has(it.product_id));
      return [...prev, ...nonDuplicate];
    });

    toast.success(`Added ${prodsToAdd.length} products to GRN!`);
    setIsMultiModalOpen(false);
    setSelectedProductIds(new Set());
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.receipt_number.trim()) { toast.error("Receipt number is required"); return; }
    if (items.length === 0) { toast.error("Add at least one product line item"); return; }
    if (items.some((it) => !it.product_id)) { toast.error("Select a product for all line items"); return; }

    setIsSubmitting(true);
    try {
      const payload = {
        receipt_number: form.receipt_number,
        supplier: form.supplier || undefined,
        reference_number: form.reference_number || undefined,
        notes: form.notes || undefined,
        status: "Completed",
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity_received: Number(it.quantity_received) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      };

      if (editingGrnId) {
        await inventoryApi.updateGoodsReceipt(editingGrnId, payload);
        toast.success("Goods Receipt (GRN) successfully updated!");
      } else {
        await inventoryApi.createGoodsReceipt(payload);
        toast.success("Goods Receipt (GRN) successfully posted!");
      }

      setViewMode("list");
      setEditingGrnId(null);
      fetchReceipts();
    } catch (error: any) {
      toast.error("Failed to save GRN: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Goods Receipt?")) return;
    try {
      await inventoryApi.deleteGoodsReceipt(id);
      toast.success("Deleted successfully");
      fetchReceipts();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = receipts.filter((r) =>
    !search || r.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
    (r.supplier || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {viewMode === "list" ? (
        <>
          {/* List Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Goods Received Notes (GRN)</h2>
              <p className="text-sm text-slate-500 mt-1">
                Receive incoming stock shipments, calculate valuation, and post inventory arrivals.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="rounded-xl"><FileDown className="size-4 mr-2" /> Export</Button>
              <Button onClick={openCreateView} className="gradient-brand text-white border-0 shadow-lg shadow-indigo-500/20 rounded-xl">
                <Plus className="size-4 mr-2" /> Create New GRN
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Search by GRN Number, Supplier, or PO..." />
          </div>

          {/* Table */}
          <Card className="overflow-hidden border-slate-200 shadow-md rounded-2xl">
            <div className="overflow-x-auto min-h-[350px] relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                  <Loader2 className="size-8 animate-spin text-indigo-600" />
                </div>
              )}
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">GRN Number</th>
                    <th className="px-6 py-4">Supplier & Reference</th>
                    <th className="px-6 py-4">Line Items</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">No Goods Receipts found. Click "Create New GRN" to post incoming stock.</td></tr>
                  )}
                  {filtered.map((grn) => {
                    const isExpanded = expandedId === grn.id;
                    return (
                      <React.Fragment key={grn.id}>
                        <tr className={`hover:bg-indigo-50/30 transition-colors ${isExpanded ? "bg-indigo-50/50" : ""}`}>
                          <td className="px-6 py-4 font-bold text-indigo-900">{grn.receipt_number}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{grn.supplier || "General Supplier"}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{grn.reference_number || "Ref N/A"}</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">{grn.items?.length || 0} Products</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              grn.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              <CheckCircle2 className="size-3.5" /> {grn.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openEditView(grn)}
                              className="h-8 gap-1.5 font-bold rounded-lg hover:bg-indigo-50 text-indigo-700 border-indigo-200"
                              title="Edit this GRN"
                            >
                              <Edit3 className="size-3.5" /> Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setExpandedId(isExpanded ? null : grn.id)}
                              className="h-8 gap-1.5 font-bold rounded-lg text-slate-600 hover:bg-slate-100"
                              title="View item breakdown"
                            >
                              <Eye className="size-3.5" /> {isExpanded ? "Hide" : "Details"}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(grn.id)} className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={5} className="p-6 border-b border-indigo-100">
                              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
                                  <div>
                                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">GRN Voucher Breakdown</div>
                                    <div className="text-lg font-black text-slate-900 mt-0.5">{grn.receipt_number}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 font-mono">Supplier: {grn.supplier || "N/A"}</span>
                                    <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 text-xs font-bold rounded-lg">
                                      <Printer className="size-3.5 mr-1" /> Print GRN Voucher
                                    </Button>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText className="size-3.5 text-indigo-500" /> Received Line Items & Pricing Breakdown
                                  </h4>
                                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                      <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                        <tr>
                                          <th className="px-4 py-2.5">#</th>
                                          <th className="px-4 py-2.5">Product ID / Name</th>
                                          <th className="px-4 py-2.5 text-center">Qty Received</th>
                                          <th className="px-4 py-2.5 text-right">Unit Price ({currency.symbol})</th>
                                          <th className="px-4 py-2.5 text-right">Subtotal ({currency.symbol})</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {grn.items && grn.items.length > 0 ? (
                                          grn.items.map((it: any, i: number) => {
                                            const qty = Number(it.quantity_received) || 0;
                                            const price = Number(it.unit_price) || 0;
                                            const prodName = productsList.find(p => p.id === it.product_id)?.name || it.product_id;
                                            return (
                                              <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-xs font-mono font-bold text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-2 font-semibold text-slate-800">{prodName}</td>
                                                <td className="px-4 py-2 text-center font-bold text-indigo-900">{qty} Units</td>
                                                <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(price)}</td>
                                                <td className="px-4 py-2 text-right font-black text-slate-900">{formatCurrency(qty * price)}</td>
                                              </tr>
                                            );
                                          })
                                        ) : (
                                          <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No items logged in this GRN.</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
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
        /*  DEDICATED SALES-STYLE GRN DOCUMENT CREATOR / EDITOR                  */
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
                  <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${editingGrnId ? "text-amber-700 bg-amber-50" : "text-indigo-600 bg-indigo-50"}`}>
                    {editingGrnId ? "Editing Goods Receipt Voucher" : "New Goods Receipt Voucher"}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{editingGrnId ? "Update Mode" : "Drafting Mode"}</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  {form.receipt_number}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => setViewMode("list")} className="rounded-xl">Cancel</Button>
              <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="gradient-brand text-white border-0 shadow-lg shadow-indigo-500/20 rounded-xl px-6">
                {isSubmitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Saving GRN...</> : <><CheckCircle2 className="size-4 mr-2" /> {editingGrnId ? "Save / Update GRN" : "Post Goods Receipt"}</>}
              </Button>
            </div>
          </div>

          {/* Document Header Metadata Form */}
          <Card className="p-6 rounded-2xl border-slate-200 shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-indigo-500" /> GRN Voucher #
                </label>
                <input type="text" value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-indigo-500" /> Supplier / Vendor
                </label>
                <input type="text" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Acme Wholesale Corp" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="size-3.5 text-indigo-500" /> PO / Ref Invoice #
                </label>
                <input type="text" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. PO-98421" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-indigo-500" /> Receiving Warehouse
                </label>
                <select value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  {warehouses.length > 0 ? (
                    warehouses.map(w => <option key={w.id} value={w.name}>{w.name} {w.is_primary ? "(Default Store)" : ""}</option>)
                  ) : (
                    <option value="Main Store">Main Store</option>
                  )}
                </select>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks / Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Add shipment tracking or quality check remarks..." />
            </div>
          </Card>

          {/* Sales-Style Line-Items Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Product Table */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6 rounded-2xl border-slate-200 shadow-sm bg-white space-y-4 overflow-visible">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="size-4 text-indigo-600" /> Received Line Items ({items.length})
                    </h3>
                    <p className="text-xs text-slate-500">Add products received in this shipment and enter receiving quantities.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      onClick={() => setIsMultiModalOpen(true)}
                      className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-xs rounded-xl"
                    >
                      <Layers className="size-3.5 mr-1.5 text-purple-600" /> + Batch Select Products
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => addItemRow()} 
                      className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 font-bold text-xs rounded-xl"
                    >
                      <Plus className="size-3.5 mr-1 text-indigo-600" /> Add Single Line
                    </Button>
                  </div>
                </div>

                {/* Scannable Quick Product Barcode Search */}
                <div className="relative z-20">
                  <ProductPicker 
                    value="" 
                    onChange={(productId) => addItemRow(productId)} 
                    placeholder="Scan product barcode or search by name to add single line item..." 
                  />
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-visible">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3 w-10">#</th>
                        <th className="px-4 py-3 min-w-[240px]">Product Item</th>
                        <th className="px-4 py-3 text-center w-36">Qty Received</th>
                        <th className="px-4 py-3 text-right w-32">Unit Price ({currency.symbol})</th>
                        <th className="px-4 py-3 text-right w-32">Valuation ({currency.symbol})</th>
                        <th className="px-3 py-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                            No product line items added yet. Use the barcode search above, click "+ Add Single Line", or click "+ Batch Select Products".
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const subtotal = calculateSubtotal(item);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 text-xs font-mono font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3 relative">
                                <ProductPicker 
                                  value={item.product_id} 
                                  onChange={(id) => handleProductSelect(idx, id)} 
                                  placeholder="Select product..." 
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button type="button" onClick={() => updateItem(idx, "quantity_received", Math.max(1, (Number(item.quantity_received) || 1) - 1))}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                                    <MinusCircle className="size-4" />
                                  </button>
                                  <input type="number" min={1} value={item.quantity_received}
                                    onChange={(e) => updateItem(idx, "quantity_received", parseInt(e.target.value) || 0)}
                                    className="w-16 text-center font-bold border border-slate-200 rounded-lg py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                  <button type="button" onClick={() => updateItem(idx, "quantity_received", (Number(item.quantity_received) || 0) + 1)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded">
                                    <PlusCircle className="size-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input type="number" min={0} step="0.01" value={item.unit_price}
                                  onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right font-semibold border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-indigo-900">
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

            {/* Right Column: Financial Summary Card */}
            <div className="space-y-4">
              <Card className="p-6 rounded-2xl border-slate-200 shadow-md bg-white space-y-5 sticky top-20">
                <h3 className="text-base font-bold text-slate-900 border-b pb-3">GRN Valuation Summary</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Line Products</span>
                    <span className="font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Received Units</span>
                    <span className="font-bold text-slate-900">{totalQty} Units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Receiving Location</span>
                    <span className="font-semibold text-slate-800">{form.warehouse}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">Total Net Valuation</span>
                    <span className="text-2xl font-black text-indigo-600">{formatCurrency(totalValuation)}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button type="button" onClick={() => handleSubmit()} disabled={isSubmitting || items.length === 0}
                    className="w-full h-12 gradient-brand text-white border-0 font-bold shadow-lg shadow-indigo-500/20 rounded-xl text-base">
                    {isSubmitting ? <><Loader2 className="size-5 mr-2 animate-spin" /> Processing...</> : (editingGrnId ? "Save / Update GRN" : "Complete & Post GRN")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setViewMode("list")} className="w-full rounded-xl">
                    Back to GRN Register
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/*  BATCH / MULTI-PRODUCT SELECTION MODAL                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isMultiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600">
                  <Layers className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Batch Select Products for GRN</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Select multiple catalog products with checkboxes to add them all into the Goods Receipt with 1 click.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMultiModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Search & Filters */}
            <div className="p-4 border-b bg-white flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  value={multiSearch}
                  onChange={(e) => setMultiSearch(e.target.value)}
                  placeholder="Search catalog products by name, SKU, or barcode..."
                  className="w-full h-10 pl-10 pr-4 text-xs font-semibold rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              {distinctCategories.length > 0 && (
                <select
                  value={multiCategory}
                  onChange={(e) => setMultiCategory(e.target.value)}
                  className="h-10 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none w-full sm:w-48"
                >
                  <option value="">All Categories</option>
                  {distinctCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllFiltered}
                  className="h-9 px-3 text-xs font-bold rounded-xl"
                >
                  Select All ({filteredMultiProducts.length})
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-9 px-3 text-xs font-bold text-slate-500 rounded-xl hover:bg-slate-100"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Products Checkbox List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {filteredMultiProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                  No catalog products found matching your search.
                </div>
              ) : (
                filteredMultiProducts.map((prod) => {
                  const isChecked = selectedProductIds.has(prod.id);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => toggleSelectProduct(prod.id)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                        isChecked ? "bg-purple-50/80 border border-purple-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-purple-600 shrink-0">
                          {isChecked ? <CheckSquare className="size-5 fill-purple-100" /> : <Square className="size-5 text-slate-300" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{prod.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                            <span>SKU: {prod.sku || "—"}</span>
                            {prod.barcode && <span>• Barcode: {prod.barcode}</span>}
                            {prod.category && <span>• Category: {prod.category}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-slate-900">{formatCurrency(Number(prod.purchase_price) || 0)}</div>
                        <div className="text-[10px] text-slate-400">Unit Cost</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-700">
                {selectedProductIds.size} Products Selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMultiModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddSelectedProducts}
                  disabled={selectedProductIds.size === 0}
                  className="gradient-brand text-white border-0 font-bold text-xs rounded-xl shadow-md"
                >
                  + Add {selectedProductIds.size} Products to GRN
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
