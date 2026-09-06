import React from "react";
import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Search, Plus, FileDown, Trash2, Loader2, Package, ArrowLeft, 
  CheckCircle2, Building2, Calendar, FileText, ShoppingBag, PlusCircle, MinusCircle, ScanLine, Tag, ArrowRightLeft, Truck, Eye, ChevronDown, ChevronUp, Printer, Globe
} from "lucide-react";
import { inventoryApi, StockMovement as StockMovementType, Warehouse, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { useTenant } from "@/contexts/tenant-context";
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
  const { tenant, companiesList } = useTenant();
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [transfers, setTransfers] = useState<StockMovementType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [allTenantWarehouses, setAllTenantWarehouses] = useState<Warehouse[]>([]);
  const [productsList, setProductsList] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Inter-Workspace Transfer Mode
  const [isInterWorkspace, setIsInterWorkspace] = useState(false);
  const [sourceCompanyId, setSourceCompanyId] = useState(tenant?.id || "");
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");

  const [form, setForm] = useState({
    movement_number: "",
    source_location: "",
    destination_location: "",
    notes: "",
    transfer_date: new Date().toISOString().slice(0, 10),
    status: "Completed",
  });

  const [items, setItems] = useState<TransferItemInput[]>([]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [m, w, prods, allWh] = await Promise.all([
        inventoryApi.getStockMovements(),
        inventoryApi.getWarehouses().catch(() => []),
        inventoryApi.getProducts({ page: 1, page_size: 200 }).then(r => r.items).catch(() => []),
        fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1"}/inventory/warehouses?all_workspaces=true`, {
          headers: {
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("bos-auth") || "{}").accessToken || ""}`
          }
        }).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      setTransfers(m);
      setWarehouses(w);
      setAllTenantWarehouses(allWh.length > 0 ? allWh : w);
      setProductsList(prods);
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
      toast.error("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [tenant?.id]);

  const openCreateView = (interWs = false) => {
    const autoNumber = `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const otherCompany = companiesList.find(c => c.id !== tenant?.id) || companiesList[0];
    
    setIsInterWorkspace(interWs);
    setSourceCompanyId(tenant?.id || "");
    setTargetCompanyId(otherCompany?.id || tenant?.id || "");

    const srcWh = warehouses[0]?.name || "Main Store";
    const destWh = interWs 
      ? `Main Store (${otherCompany?.name || "Workspace 2"})`
      : (warehouses[1]?.name || warehouses[0]?.name || "Secondary Warehouse");

    setSourceWarehouseId(warehouses[0]?.id || "");
    setTargetWarehouseId("");

    setForm({
      movement_number: autoNumber,
      source_location: srcWh,
      destination_location: destWh,
      notes: interWs ? `Inter-workspace stock transfer to ${otherCompany?.name || "Target Workspace"}` : "",
      transfer_date: new Date().toISOString().slice(0, 10),
      status: "Completed",
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
    if (!form.source_location || !form.destination_location) { toast.error("Select both source and destination locations"); return; }
    if (!isInterWorkspace && form.source_location === form.destination_location) { toast.error("Source and destination warehouses cannot be the same"); return; }
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
          source_company_id: isInterWorkspace ? (sourceCompanyId || tenant?.id) : tenant?.id,
          target_company_id: isInterWorkspace ? (targetCompanyId || tenant?.id) : tenant?.id,
          source_warehouse_id: sourceWarehouseId || undefined,
          target_warehouse_id: targetWarehouseId || undefined,
        });
      }
      toast.success(isInterWorkspace ? "Inter-Workspace Stock Transfer completed!" : "Stock Transfer voucher successfully posted!");
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
    <div className="space-y-6 pb-12">
      {viewMode === "list" ? (
        <>
          {/* List Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Stock Transfers & Inter-Workspace Movement</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold border border-purple-200">
                  {tenant?.name || "Active Workspace"}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Transfer stock seamlessly between warehouses, distribution hubs, and cross-workspace companies.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Button variant="outline" className="rounded-xl"><FileDown className="size-4 mr-2" /> Export</Button>
              <Button
                onClick={() => openCreateView(true)}
                className="gradient-brand text-white border-0 shadow-sm rounded-xl font-bold"
              >
                <Globe className="size-4 mr-2" /> Inter-Workspace Transfer
              </Button>
              <Button
                onClick={() => openCreateView(false)}
                className="bg-purple-700 hover:bg-purple-800 text-white border-0 shadow-sm rounded-xl font-semibold"
              >
                <Plus className="size-4 mr-2" /> Internal Transfer
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Search by Transfer #, Source, or Destination..." />
          </div>

          {/* Table Section */}
          <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto min-h-[350px] relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                  <Loader2 className="size-8 animate-spin text-purple-700" />
                </div>
              )}
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-left whitespace-nowrap">Transfer #</th>
                    <th className="px-6 py-4 text-left whitespace-nowrap">Type / Route</th>
                    <th className="px-6 py-4 text-left whitespace-nowrap">Source Location</th>
                    <th className="px-6 py-4 text-left whitespace-nowrap">Destination Location</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">Quantity</th>
                    <th className="px-6 py-4 text-left whitespace-nowrap">Date</th>
                    <th className="px-6 py-4 text-center whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 font-medium">
                  {filtered.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                        No Stock Transfers found. Click "Inter-Workspace Transfer" or "Internal Transfer" to move stock.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((tr) => {
                      const isCrossCompany = Boolean(
                        (tr as any).source_company_id && 
                        (tr as any).target_company_id && 
                        (tr as any).source_company_id !== (tr as any).target_company_id
                      );

                      return (
                        <tr key={tr.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-6 py-4 font-mono font-bold text-purple-700 text-sm">
                            {tr.movement_number}
                          </td>
                          <td className="px-6 py-4">
                            {isCrossCompany ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Globe className="size-3" /> Cross-Workspace
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                <Building2 className="size-3" /> Internal Warehouse
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{tr.source_location}</div>
                            {(tr as any).source_company_name && (
                              <div className="text-[10px] text-purple-600 font-semibold">🏢 {(tr as any).source_company_name}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{tr.destination_location}</div>
                            {(tr as any).target_company_name && (
                              <div className="text-[10px] text-purple-600 font-semibold">🏢 {(tr as any).target_company_name}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            {tr.quantity} Units
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {(tr as any).created_at ? (tr as any).created_at.slice(0, 10) : "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              tr.status === "Completed"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-purple-500/10 text-purple-700 border-purple-500/20"
                            }`}>
                              <Truck className="size-3" /> {tr.status || "Completed"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  setForm({
                                    movement_number: tr.movement_number,
                                    source_location: tr.source_location || "",
                                    destination_location: tr.destination_location || "",
                                    notes: (tr as any).reference_note || (tr as any).notes || "",
                                    transfer_date: (tr as any).created_at ? (tr as any).created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                                    status: tr.status || "Completed",
                                  });
                                  setItems([{
                                    product_id: tr.product_id,
                                    product_name: (tr as any).product_name || tr.product_id,
                                    quantity: Number(tr.quantity) || 1,
                                    unit_price: 150
                                  }]);
                                  setViewMode("create");
                                }}
                                className="h-8 text-xs font-semibold hover:bg-purple-50 hover:text-purple-700 rounded-lg"
                              >
                                <Eye className="size-3.5 mr-1" /> View / Edit
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(tr.id)} className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════ */
        /*  DEDICATED STOCK TRANSFER ORDER & INTER-WORKSPACE CREATOR             */
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
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md",
                    isInterWorkspace ? "bg-purple-100 text-purple-700" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {isInterWorkspace ? "🏢 Inter-Workspace Transfer" : "Internal Stock Transfer"}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Stock Movement</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  {form.movement_number}
                </h2>
              </div>
            </div>

            {/* Mode Toggle & Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold mr-2">
                <button
                  type="button"
                  onClick={() => openCreateView(false)}
                  className={cn("px-3 py-1.5 rounded-lg transition-all", !isInterWorkspace ? "bg-white text-purple-700 shadow-xs" : "text-slate-600")}
                >
                  Internal
                </button>
                <button
                  type="button"
                  onClick={() => openCreateView(true)}
                  className={cn("px-3 py-1.5 rounded-lg transition-all flex items-center gap-1", isInterWorkspace ? "bg-white text-purple-700 shadow-xs" : "text-slate-600")}
                >
                  <Globe className="size-3" /> Inter-Workspace
                </button>
              </div>

              <Button variant="outline" onClick={() => setViewMode("list")} className="rounded-xl">Cancel</Button>
              <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="gradient-brand text-white border-0 shadow-lg shadow-purple-500/20 rounded-xl px-6 font-bold">
                {isSubmitting ? <><Loader2 className="size-4 mr-2 animate-spin" /> Transferring...</> : <><CheckCircle2 className="size-4 mr-2" /> Post Transfer Order</>}
              </Button>
            </div>
          </div>

          {/* Document Header Metadata Form */}
          <Card className="p-6 rounded-2xl border-slate-200 shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-purple-600" /> Transfer Voucher #
                </label>
                <input type="text" value={form.movement_number} onChange={(e) => setForm({ ...form, movement_number: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50" />
              </div>

              {/* Source Warehouse / Company */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-purple-600" /> Source Workspace & Warehouse
                </label>
                {isInterWorkspace ? (
                  <div className="space-y-1.5">
                    <select
                      value={sourceCompanyId}
                      onChange={(e) => {
                        setSourceCompanyId(e.target.value);
                        const srcName = companiesList.find(c => c.id === e.target.value)?.name || tenant?.name;
                        setForm(prev => ({ ...prev, source_location: `Main Store (${srcName})` }));
                      }}
                      className="w-full border border-purple-200 bg-purple-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      {companiesList.map(c => (
                        <option key={c.id} value={c.id}>
                          🏢 {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={form.source_location}
                      onChange={(e) => {
                        setForm({ ...form, source_location: e.target.value });
                        const match = warehouses.find(w => w.name === e.target.value);
                        if (match) setSourceWarehouseId(match.id);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none"
                    >
                      {warehouses.length > 0 ? (
                        warehouses.map(w => <option key={w.id} value={w.name}>{w.name} {w.is_default ? "(Default Main Store)" : ""}</option>)
                      ) : (
                        <option value="Main Store">Main Store</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <select value={form.source_location} onChange={(e) => {
                    setForm({ ...form, source_location: e.target.value });
                    const match = warehouses.find(w => w.name === e.target.value);
                    if (match) setSourceWarehouseId(match.id);
                  }}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                    {warehouses.length > 0 ? (
                      warehouses.map(w => <option key={w.id} value={w.name}>{w.name} {w.is_default ? "(Default Main Store)" : ""}</option>)
                    ) : (
                      <option value="Main Store">Main Store</option>
                    )}
                  </select>
                )}
              </div>

              {/* Destination Warehouse / Company */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-purple-600" /> Destination Workspace & Warehouse
                </label>
                {isInterWorkspace ? (
                  <div className="space-y-1.5">
                    <select
                      value={targetCompanyId}
                      onChange={(e) => {
                        setTargetCompanyId(e.target.value);
                        const tgtName = companiesList.find(c => c.id === e.target.value)?.name || "Target Workspace";
                        setForm(prev => ({ ...prev, destination_location: `Main Store (${tgtName})` }));
                      }}
                      className="w-full border border-purple-200 bg-purple-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      {companiesList.map(c => (
                        <option key={c.id} value={c.id}>
                          🏢 {c.name} {c.id === tenant?.id ? "(Current Workspace)" : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={form.destination_location}
                      onChange={(e) => setForm({ ...form, destination_location: e.target.value })}
                      placeholder="Destination Warehouse / Shelf"
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none"
                    />
                  </div>
                ) : (
                  <select value={form.destination_location} onChange={(e) => {
                    setForm({ ...form, destination_location: e.target.value });
                    const match = warehouses.find(w => w.name === e.target.value);
                    if (match) setTargetWarehouseId(match.id);
                  }}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                    {warehouses.length > 0 ? (
                      warehouses.map(w => <option key={w.id} value={w.name}>{w.name}</option>)
                    ) : (
                      <option value="Secondary Warehouse">Secondary Warehouse</option>
                    )}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-purple-600" /> Transfer Date
                </label>
                <input type="date" value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transfer Notes & Dispatch Reference</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. Cross-workspace inventory replenishment via Dispatch Truck KA-01-9876..." />
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
