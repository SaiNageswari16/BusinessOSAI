import React from "react";
import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Search, Plus, FileDown, Trash2, Loader2, Package, ArrowLeft, 
  CheckCircle2, Building2, Calendar, FileText, ShoppingBag, PlusCircle, MinusCircle, ScanLine, Tag, ArrowRightLeft, Truck, Eye, ChevronDown, ChevronUp, Printer
} from "lucide-react";
import { inventoryApi, StockMovement as StockMovementType, Warehouse, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface TransferItemInput {
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

export function StockTransfer() {
    const { currency, formatCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [transfers, setTransfers] = useState<StockMovementType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productsList, setProductsList] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    movement_number: "",
    source_location: "",
    destination_location: "",
    notes: "",
    transfer_date: new Date().toISOString().slice(0, 10),
    status: "In Transit",
  });

  const [items, setItems] = useState<TransferItemInput[]>([]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [m, w, prods] = await Promise.all([
        inventoryApi.getStockMovements(),
        inventoryApi.getWarehouses().catch(() => []),
        inventoryApi.getProducts({ page: 1, page_size: 200 }).then(r => r.items).catch(() => [])
      ]);
      setTransfers(m);
      setWarehouses(w);
      setProductsList(prods);
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
      toast.error("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreateView = () => {
    const autoNumber = `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const srcWh = warehouses[0]?.name || "Main Warehouse";
    const destWh = warehouses[1]?.name || warehouses[0]?.name || "Secondary Depot";
    setForm({
      movement_number: autoNumber,
      source_location: srcWh,
      destination_location: destWh,
      notes: "",
      transfer_date: new Date().toISOString().slice(0, 10),
      status: "In Transit",
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
        quantity: 1,
        unit_price: Number(initialProd?.selling_price || initialProd?.purchase_price) || 0,
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
      };
    }));
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: keyof TransferItemInput, value: any) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const calculateSubtotal = (item: TransferItemInput) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return qty * price;
  };

  const totalTransferQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalValuation = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.movement_number.trim()) { toast.error("Transfer number is required"); return; }
    if (!form.source_location || !form.destination_location) { toast.error("Select both source and destination warehouses"); return; }
    if (form.source_location === form.destination_location) { toast.error("Source and destination warehouses cannot be the same"); return; }
    if (items.length === 0) { toast.error("Add at least one product line item"); return; }
    if (items.some((it) => !it.product_id)) { toast.error("Select a product for all line items"); return; }

    setIsSubmitting(true);
    try {
      for (const item of items) {
        await inventoryApi.createStockMovement({
          movement_number: form.movement_number,
          product_id: item.product_id,
          source_location: form.source_location,
          destination_location: form.destination_location,
          quantity: Number(item.quantity) || 0,
          notes: form.notes || undefined,
          status: form.status,
        });
      }
      toast.success("Stock Transfer voucher successfully posted!");
      setViewMode("list");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed to post Stock Transfer: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transfer?")) return;
    try {
      await inventoryApi.deleteStockMovement(id);
      toast.success("Deleted");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = transfers.filter((t) =>
    !search || t.movement_number.toLowerCase().includes(search.toLowerCase()) ||
    t.source_location.toLowerCase().includes(search.toLowerCase()) ||
    t.destination_location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-12">
      {viewMode === "list" ? (
        <>
          {/* ── Page Header ── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none">
                  Stock Transfers
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                  {transfers.length} Transfers
                </span>
              </div>
              <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-normal">
                Transfer stock seamlessly between warehouses, distribution hubs, and retail stores.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                className="h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
                onClick={() => toast.info("Exporting stock transfers report...")}
              >
                <FileDown className="size-3.5 mr-1.5 text-slate-500" /> Export
              </Button>
              <Button 
                size="sm"
                onClick={openCreateView} 
                className="h-9 px-3.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Plus className="size-4 mr-1.5" /> Create New Transfer
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
                placeholder="Search by Transfer #, Source, or Destination..." 
              />
            </div>
          </div>

          {/* ── DataTable ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
              <Loader2 className="size-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-semibold text-slate-600">Loading stock transfer records...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-14 border border-dashed rounded-2xl bg-slate-50/50">
              <ArrowRightLeft className="size-12 mx-auto text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Stock Transfers found</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">Click 'Create New Transfer' to move inventory between locations.</p>
              <Button onClick={openCreateView} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg h-9">
                <Plus className="size-4 mr-1.5" /> Create New Transfer
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
                    <tr>
                      <th className="px-4 py-3">Transfer # & Date</th>
                      <th className="px-4 py-3">Source Warehouse</th>
                      <th className="px-4 py-3">Destination Warehouse</th>
                      <th className="px-4 py-3">Product Transferred</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((tr) => {
                      const prodObj = productsList.find(p => p.id === tr.product_id);
                      return (
                        <tr 
                          key={tr.id} 
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => {
                            setForm({
                              movement_number: tr.movement_number,
                              source_location: tr.source_location || "",
                              destination_location: tr.destination_location || "",
                              notes: tr.reference_note || "",
                              transfer_date: tr.created_at ? tr.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                              status: tr.status || "In Transit",
                            });
                            setItems([{
                              product_id: tr.product_id,
                              product_name: tr.product_name,
                              quantity: Number(tr.quantity) || 1,
                              unit_price: 150
                            }]);
                            setViewMode("create");
                          }}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                            <div>{tr.movement_number}</div>
                            <div className="text-[10.5px] font-normal text-slate-400 font-sans mt-0.5">
                              {tr.created_at ? new Date(tr.created_at).toLocaleDateString() : "Today"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/80">
                              {tr.source_location}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80">
                              {tr.destination_location}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{prodObj?.name || tr.product_name || tr.product_id}</div>
                            {prodObj?.sku && <div className="text-[10.5px] text-slate-400 font-mono">{prodObj.sku}</div>}
                          </td>
                          <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                            {tr.quantity} Units
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              tr.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80" : "bg-blue-50 text-blue-700 border border-blue-200/80"
                            }`}>
                              <Truck className="size-3" />
                              {tr.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setForm({
                                    movement_number: tr.movement_number,
                                    source_location: tr.source_location || "",
                                    destination_location: tr.destination_location || "",
                                    notes: tr.reference_note || "",
                                    transfer_date: tr.created_at ? tr.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                                    status: tr.status || "In Transit",
                                  });
                                  setItems([{
                                    product_id: tr.product_id,
                                    product_name: tr.product_name,
                                    quantity: Number(tr.quantity) || 1,
                                    unit_price: 150
                                  }]);
                                  setViewMode("create");
                                }}
                                className="size-8 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition cursor-pointer"
                                title="View / Edit Transfer"
                              >
                                <Eye className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(tr.id)}
                                className="size-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                                title="Delete Transfer"
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
                <span>Showing {filtered.length} of {transfers.length} transfers</span>
                <span className="font-semibold text-slate-700">Click any row to open full voucher document</span>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════ */
        /*  DEDICATED SALES-STYLE STOCK TRANSFER DOCUMENT CREATOR                */
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
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                    New Stock Transfer Order
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Transit Mode</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  {form.movement_number}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={() => setViewMode("list")} className="rounded-xl">Cancel</Button>
              <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-500/20 rounded-xl px-6 font-bold">
                {isSubmitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Dispatching...</> : <><CheckCircle2 className="size-4 mr-2" /> Post Transfer Order</>}
              </Button>
            </div>
          </div>

          {/* Document Header Metadata Form */}
          <Card className="p-6 rounded-2xl border-slate-200 shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-emerald-500" /> Transfer Voucher #
                </label>
                <input type="text" value={form.movement_number} onChange={(e) => setForm({ ...form, movement_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-emerald-500" /> From Source Warehouse
                </label>
                <select value={form.source_location} onChange={(e) => setForm({ ...form, source_location: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  {warehouses.length > 0 ? (
                    warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)
                  ) : (
                    <option value="Main Warehouse">Main Warehouse</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-emerald-500" /> To Destination Warehouse
                </label>
                <select value={form.destination_location} onChange={(e) => setForm({ ...form, destination_location: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  {warehouses.length > 0 ? (
                    warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)
                  ) : (
                    <option value="Secondary Depot">Secondary Depot</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-emerald-500" /> Transfer Date
                </label>
                <input type="date" value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transfer Notes / Driver Details</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Inter-branch delivery via Vehicle KA-01-AB-1234..." />
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
                      <ShoppingBag className="size-4 text-emerald-600" /> Transferred Product Items
                    </h3>
                    <p className="text-xs text-slate-500">Select products to transfer from source to destination warehouse.</p>
                  </div>
                  <Button type="button" onClick={() => addItemRow()} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-0 font-bold text-xs rounded-xl">
                    + Add Product Line
                  </Button>
                </div>

                {/* Scannable Barcode Product Search */}
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                  <ProductPicker 
                    value="" 
                    onChange={(productId) => addItemRow(productId)} 
                    placeholder="Scan product barcode or search by name to transfer..." 
                  />
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Product Item</th>
                        <th className="px-4 py-3 text-center">Transfer Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price ({currency.symbol})</th>
                        <th className="px-4 py-3 text-right">Transferred Value ({currency.symbol})</th>
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
                                  <button type="button" onClick={() => updateItem(idx, "quantity", Math.max(1, (Number(item.quantity) || 1) - 1))}
                                    className="p-1 text-slate-400 hover:text-emerald-600 rounded">
                                    <MinusCircle className="size-4" />
                                  </button>
                                  <input type="number" min={1} value={item.quantity}
                                    onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                                    className="w-16 text-center font-bold border border-slate-200 rounded-lg py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                                  <button type="button" onClick={() => updateItem(idx, "quantity", (Number(item.quantity) || 0) + 1)}
                                    className="p-1 text-slate-400 hover:text-emerald-600 rounded">
                                    <PlusCircle className="size-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input type="number" min={0} step="0.01" value={item.unit_price}
                                  onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right font-semibold border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-900">
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
                <h3 className="text-base font-bold text-slate-900 border-b pb-3">Transfer Summary</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>From Source</span>
                    <span className="font-bold text-slate-900">{form.source_location}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>To Destination</span>
                    <span className="font-bold text-slate-900">{form.destination_location}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Line Products</span>
                    <span className="font-bold text-slate-900">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Transferred Units</span>
                    <span className="font-bold text-slate-900">{totalTransferQty} Units</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-slate-900">Total Goods Valuation</span>
                    <span className="text-2xl font-black text-emerald-600">{formatCurrency(totalValuation)}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button type="button" onClick={() => handleSubmit()} disabled={isSubmitting || items.length === 0}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-bold shadow-lg shadow-emerald-500/20 rounded-xl text-base">
                    {isSubmitting ? <><Loader2 className="size-5 mr-2 animate-spin" /> Dispatching...</> : "Post & Dispatch Transfer"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setViewMode("list")} className="w-full rounded-xl">
                    Back to Transfer Register
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
