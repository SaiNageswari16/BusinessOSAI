import React from "react";
import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Search, Plus, FileDown, Trash2, Loader2, Package, ArrowLeft, 
  CheckCircle2, Building2, Calendar, FileText, ShoppingBag, PlusCircle, MinusCircle, ScanLine, Tag, Send, Eye, ChevronDown, ChevronUp, Printer
} from "lucide-react";
import { inventoryApi, GoodsIssue as GoodsIssueType, Warehouse, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface IssueItemInput {
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity_issued: number;
  unit_price: number;
  available_stock?: number;
}

export function GoodsIssue() {
    const { currency, formatCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [issues, setIssues] = useState<GoodsIssueType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productsList, setProductsList] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    issue_number: "",
    recipient: "",
    reference_number: "",
    warehouse: "",
    notes: "",
    issue_date: new Date().toISOString().slice(0, 10),
  });

  const [items, setItems] = useState<IssueItemInput[]>([]);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const [res, whs, prods] = await Promise.all([
        inventoryApi.getGoodsIssues(),
        inventoryApi.getWarehouses().catch(() => []),
        inventoryApi.getProducts({ page: 1, page_size: 200 }).then(r => r.items).catch(() => [])
      ]);
      setIssues(res);
      setWarehouses(whs);
      setProductsList(prods);
    } catch (error) {
      console.error("Failed to fetch Goods Issues:", error);
      toast.error("Failed to load Goods Issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const openCreateView = () => {
    const autoNumber = `GI-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    setForm({
      issue_number: autoNumber,
      recipient: "",
      reference_number: "",
      warehouse: warehouses[0]?.name || "Main Warehouse",
      notes: "",
      issue_date: new Date().toISOString().slice(0, 10),
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
        quantity_issued: 1,
        unit_price: Number(initialProd?.selling_price || initialProd?.purchase_price) || 0,
        available_stock: Number(initialProd?.initial_stock) || 0,
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
        unit_price: Number(selected?.selling_price || selected?.purchase_price) || item.unit_price,
        available_stock: Number(selected?.initial_stock) || 0,
      };
    }));
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: keyof IssueItemInput, value: any) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const calculateSubtotal = (item: IssueItemInput) => {
    const qty = Number(item.quantity_issued) || 0;
    const price = Number(item.unit_price) || 0;
    return qty * price;
  };

  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity_issued) || 0), 0);
  const totalValuation = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.issue_number.trim()) { toast.error("Issue number is required"); return; }
    if (items.length === 0) { toast.error("Add at least one product line item"); return; }
    if (items.some((it) => !it.product_id)) { toast.error("Select a product for all line items"); return; }

    setIsSubmitting(true);
    try {
      await inventoryApi.createGoodsIssue({
        issue_number: form.issue_number,
        recipient: form.recipient || undefined,
        reference_number: form.reference_number || undefined,
        notes: form.notes || undefined,
        status: "Completed",
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity_issued: Number(it.quantity_issued) || 0,
        })),
      });
      toast.success("Goods Issue voucher successfully posted!");
      setViewMode("list");
      fetchIssues();
    } catch (error: any) {
      toast.error("Failed to post Goods Issue: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Goods Issue?")) return;
    try {
      await inventoryApi.deleteGoodsIssue(id);
      toast.success("Deleted");
      fetchIssues();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = issues.filter((gi) =>
    !search || gi.issue_number.toLowerCase().includes(search.toLowerCase()) ||
    (gi.recipient || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {viewMode === "list" ? (
        <>
          {/* List Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Goods Issue Vouchers
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Dispatch and deduct stock from inventory for customer orders, internal transfers, or consumption.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="rounded-xl"><FileDown className="size-4 mr-2" /> Export</Button>
              <Button onClick={openCreateView} className="bg-purple-700 hover:bg-purple-800 text-white border-0 shadow-sm rounded-xl font-semibold">
                <Plus className="size-4 mr-2" /> Create New Goods Issue
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Search by Issue #, Recipient, or Ref..." />
          </div>

          {/* Table */}
          <Card className="overflow-hidden border-slate-200 shadow-md rounded-2xl">
            <div className="overflow-x-auto min-h-[350px] relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                  <Loader2 className="size-8 animate-spin text-rose-600" />
                </div>
              )}
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Issue Number</th>
                    <th className="px-6 py-4">Recipient & Reference</th>
                    <th className="px-6 py-4">Items Dispatched</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.length === 0 && !loading && (
                    <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">No Goods Issues found. Click "Create New Goods Issue" to dispatch inventory.</td></tr>
                  )}
                  {filtered.map((gi) => {
                    const isExpanded = expandedId === gi.id;
                    return (
                      <React.Fragment key={gi.id}>
                        <tr className={`hover:bg-rose-50/30 transition-colors ${isExpanded ? "bg-rose-50/50" : ""}`}>
                          <td className="px-6 py-4 font-bold text-rose-900">{gi.issue_number}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{gi.recipient || "Internal Recipient"}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{gi.reference_number || "Ref N/A"}</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">{gi.items?.length || 0} Products</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              gi.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              <CheckCircle2 className="size-3.5" /> {gi.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setForm({
                                  issue_number: gi.issue_number,
                                  recipient: gi.recipient || "",
                                  reference_number: gi.reference_number || "",
                                  warehouse: (gi as any).warehouse_id || (gi as any).warehouse || "",
                                  notes: (gi as any).notes || "",
                                  issue_date: (gi as any).created_at ? (gi as any).created_at.slice(0, 10) : ((gi as any).issue_date ? (gi as any).issue_date.slice(0, 10) : new Date().toISOString().slice(0, 10)),
                                });
                                if (gi.items && gi.items.length > 0) {
                                  setItems(gi.items.map((it: any) => ({
                                    product_id: it.product_id,
                                    product_name: it.product_name,
                                    quantity_issued: Number(it.quantity_issued) || 1,
                                    unit_price: Number(it.unit_price) || 0,
                                    available_stock: 500
                                  })));
                                }
                                setViewMode("create");
                              }}
                              className="h-8 gap-1.5 font-bold rounded-lg hover:bg-rose-50"
                            >
                              <Eye className="size-4" /> View / Edit Page
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(gi.id)} className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={5} className="p-6 border-b border-rose-100">
                              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
                                  <div>
                                    <div className="text-xs font-bold text-rose-600 uppercase tracking-wider">Goods Issue Voucher Breakdown</div>
                                    <div className="text-lg font-black text-slate-900 mt-0.5">{gi.issue_number}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 font-mono">Recipient: {gi.recipient || "N/A"}</span>
                                    <Button size="sm" variant="outline" onClick={() => window.print()} className="h-8 text-xs font-bold rounded-lg">
                                      <Printer className="size-3.5 mr-1" /> Print Issue Voucher
                                    </Button>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <FileText className="size-3.5 text-rose-500" /> Dispatched Line Items & Breakdown
                                  </h4>
                                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                      <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                        <tr>
                                          <th className="px-4 py-2.5">#</th>
                                          <th className="px-4 py-2.5">Product ID / Name</th>
                                          <th className="px-4 py-2.5 text-center">Qty Issued</th>
                                          <th className="px-4 py-2.5 text-right">Unit Value ({currency.symbol})</th>
                                          <th className="px-4 py-2.5 text-right">Subtotal ({currency.symbol})</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {gi.items && gi.items.length > 0 ? (
                                          gi.items.map((it: any, i: number) => {
                                            const qty = Number(it.quantity_issued) || 0;
                                            const prodObj = productsList.find(p => p.id === it.product_id);
                                            const price = Number(prodObj?.selling_price || prodObj?.purchase_price) || 0;
                                            return (
                                              <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-xs font-mono font-bold text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-2 font-semibold text-slate-800">{prodObj?.name || it.product_id}</td>
                                                <td className="px-4 py-2 text-center font-bold text-rose-900">{qty} Units</td>
                                                <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(price)}</td>
                                                <td className="px-4 py-2 text-right font-black text-slate-900">{formatCurrency(qty * price)}</td>
                                              </tr>
                                            );
                                          })
                                        ) : (
                                          <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No items logged in this Goods Issue.</td></tr>
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
        /*  DEDICATED SALES-STYLE GOODS ISSUE DOCUMENT CREATOR                    */
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
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md">
                    New Goods Issue Voucher
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Drafting Mode</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  {form.issue_number}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => setViewMode("list")} className="rounded-xl">Cancel</Button>
              <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="bg-purple-700 hover:bg-purple-800 text-white border-0 shadow-md shadow-purple-500/20 rounded-xl px-6 font-bold">
                {isSubmitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Dispatching...</> : <><CheckCircle2 className="size-4 mr-2" /> Post Goods Issue</>}
              </Button>
            </div>
          </div>

          {/* Document Header Metadata Form */}
          <Card className="p-6 rounded-2xl border-slate-200 shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-rose-500" /> Goods Issue Voucher #
                </label>
                <input type="text" value={form.issue_number} onChange={(e) => setForm({ ...form, issue_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-rose-500" /> Recipient / Customer
                </label>
                <input type="text" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-500" placeholder="e.g. Retail Store #3 / Production Dept" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="size-3.5 text-rose-500" /> Sales Order / Ref #
                </label>
                <input type="text" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-rose-500" placeholder="e.g. SO-88412" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-rose-500" /> Source Warehouse
                </label>
                <select value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-500 bg-white">
                  {warehouses.length > 0 ? (
                    warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)
                  ) : (
                    <option value="Main Warehouse">Main Warehouse</option>
                  )}
                </select>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks / Purpose</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500" placeholder="Add dispatch reason or delivery notes..." />
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
                      <ShoppingBag className="size-4 text-rose-600" /> Dispatched Product Items
                    </h3>
                    <p className="text-xs text-slate-500">Select products and quantities to deduct from inventory stock.</p>
                  </div>
                  <Button type="button" onClick={() => addItemRow()} className="bg-rose-50 text-rose-600 hover:bg-rose-100 border-0 font-bold text-xs rounded-xl">
                    + Add Product Line
                  </Button>
                </div>

                {/* Scannable Barcode Product Search */}
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-rose-500" />
                  <ProductPicker 
                    value="" 
                    onChange={(productId) => addItemRow(productId)} 
                    placeholder="Scan product barcode or search by name to dispatch..." 
                  />
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Product Item</th>
                        <th className="px-4 py-3 text-center">Qty Issued</th>
                        <th className="px-4 py-3 text-right">Unit Price ({currency.symbol})</th>
                        <th className="px-4 py-3 text-right">Dispatched Value ({currency.symbol})</th>
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
                              <td className="px-4 py-3 min-w-[200px]">
                                <ProductPicker 
                                  value={item.product_id} 
                                  onChange={(id) => handleProductSelect(idx, id)} 
                                  placeholder="Select product..." 
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button type="button" onClick={() => updateItem(idx, "quantity_issued", Math.max(1, (Number(item.quantity_issued) || 1) - 1))}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded">
                                    <MinusCircle className="size-4" />
                                  </button>
                                  <input type="number" min={1} value={item.quantity_issued}
                                    onChange={(e) => updateItem(idx, "quantity_issued", parseInt(e.target.value) || 0)}
                                    className="w-16 text-center font-bold border border-slate-200 rounded-lg py-1 text-sm outline-none focus:ring-2 focus:ring-rose-500" />
                                  <button type="button" onClick={() => updateItem(idx, "quantity_issued", (Number(item.quantity_issued) || 0) + 1)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded">
                                    <PlusCircle className="size-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input type="number" min={0} step="0.01" value={item.unit_price}
                                  onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right font-semibold border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-rose-500" />
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-rose-900">
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
                <h3 className="text-base font-bold text-slate-900 border-b pb-3">Goods Issue Summary</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Line Products</span>
                    <span className="font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Dispatched Units</span>
                    <span className="font-bold text-slate-900">{totalQty} Units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Dispatch Location</span>
                    <span className="font-semibold text-slate-800">{form.warehouse}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">Total Issue Valuation</span>
                    <span className="text-2xl font-black text-rose-600">{formatCurrency(totalValuation)}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button type="button" onClick={() => handleSubmit()} disabled={isSubmitting || items.length === 0}
                    className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white border-0 font-bold shadow-md shadow-purple-500/20 rounded-xl text-base">
                    {isSubmitting ? <><Loader2 className="size-5 mr-2 animate-spin" /> Processing...</> : "Post & Issue Stock"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setViewMode("list")} className="w-full rounded-xl">
                    Back to Goods Issue Register
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
