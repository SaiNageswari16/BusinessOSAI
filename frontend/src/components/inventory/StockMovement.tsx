import React from "react";
import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { 
  Search, Plus, History, Trash2, Loader2, ArrowRightLeft, FileDown, 
  CheckCircle2, ArrowRight, Activity, TrendingUp, Layers, Eye, ChevronDown, ChevronUp, Printer, FileText
} from "lucide-react";
import { inventoryApi, Warehouse, StockMovement as StockMovementType } from "../../lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

export function StockMovement() {
    const { currency, formatCurrency } = useCurrency();
  const [movements, setMovements] = useState<StockMovementType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [m, w] = await Promise.all([
        inventoryApi.getStockMovements(),
        inventoryApi.getWarehouses().catch(() => []),
      ]);
      setMovements(m);
      setWarehouses(w);
    } catch (error) {
      console.error("Failed to fetch stock movements:", error);
      toast.error("Failed to load Stock Movements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this movement record?")) return;
    try {
      await inventoryApi.deleteStockMovement(id);
      toast.success("Deleted");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = movements.filter((m) =>
    !search || m.movement_number.toLowerCase().includes(search.toLowerCase()) ||
    m.source_location.toLowerCase().includes(search.toLowerCase()) ||
    m.destination_location.toLowerCase().includes(search.toLowerCase()) ||
    (m.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.sku || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.notes || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalTransfersCount = movements.length;
  const totalUnitsMoved = movements.reduce((sum, m) => sum + (m.quantity || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Stock Movement Audit & Activity Ledger
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Complete real-time timeline stream of all warehouse stock transfers, movements, and inventory logs.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="rounded-xl"><FileDown className="size-4 mr-2" /> Export Audit Ledger</Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl border-slate-200 shadow-sm bg-white flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Movement Events</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalTransfersCount} Events</div>
          </div>
          <div className="size-12 rounded-xl bg-purple-50 text-purple-700 grid place-items-center">
            <Activity className="size-6" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border-slate-200 shadow-sm bg-white flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Volume Moved</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{totalUnitsMoved} Units</div>
          </div>
          <div className="size-12 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
            <TrendingUp className="size-6" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border-slate-200 shadow-sm bg-white flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Tracked Warehouses</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{warehouses.length || 1} Depots</div>
          </div>
          <div className="size-12 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
            <Layers className="size-6" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="Search by Movement #, Source, or Destination..." />
      </div>

      {/* Audit Table */}
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
                <th className="px-5 py-4">Movement Voucher #</th>
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4 text-center">Qty</th>
                <th className="px-5 py-4">From → To</th>
                <th className="px-5 py-4">Notes</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-slate-400">No Stock Movements logged yet. Movements are auto-created when stock adjustments, GRNs, or transfers occur.</td></tr>
              )}
              {filtered.map((m) => {
                const isExpanded = expandedId === m.id;
                // Determine movement type from notes/source/destination
                const isAdjustment = (m.notes || "").toLowerCase().includes("adjustment");
                const isSale = m.source_location?.toLowerCase().includes("sale") || m.destination_location?.toLowerCase().includes("sale");
                const isGRN = (m.notes || "").toLowerCase().includes("grn") || m.source_location?.toLowerCase().includes("grn");
                const movTypeLabel = isAdjustment ? "Adjustment" : isGRN ? "GRN Receipt" : isSale ? "Sale Deduction" : "Transfer";
                const movTypeClass = isAdjustment ? "bg-amber-50 text-amber-700 border-amber-200" : isGRN ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isSale ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-blue-50 text-blue-700 border-blue-200";
                return (
                  <React.Fragment key={m.id}>
                    <tr className={`hover:bg-indigo-50/30 transition-colors ${isExpanded ? "bg-indigo-50/50" : ""}`}>
                      <td className="px-5 py-3 font-mono font-bold text-indigo-900 text-xs">{m.movement_number}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 text-sm">{m.product_name || "Unknown Product"}</span>
                          {m.sku && <span className="text-xs text-slate-400 font-mono">SKU: {m.sku}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 rounded-md text-xs font-bold ${movTypeClass}`}>
                          <ArrowRightLeft className="size-3.5" /> {movTypeLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center font-mono font-black text-emerald-600">
                        {m.quantity} units
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-bold max-w-[90px] truncate" title={m.source_location}>{m.source_location}</span>
                          <ArrowRight className="size-3 text-slate-400 shrink-0" />
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-bold max-w-[90px] truncate" title={m.destination_location}>{m.destination_location}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 max-w-[140px] truncate" title={m.notes || ""}>{m.notes || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          m.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          <CheckCircle2 className="size-3.5" /> {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right space-x-1">
                        <Button variant="outline" size="sm"
                          onClick={() => setExpandedId(prev => prev === m.id ? null : m.id)}
                          className={`h-8 gap-1 font-bold rounded-lg ${isExpanded ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-indigo-50"}`}>
                          <Eye className="size-4" />
                          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={8} className="p-5 border-b border-indigo-100">
                          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Movement #</div>
                              <div className="font-mono font-bold text-indigo-800">{m.movement_number}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Product</div>
                              <div className="font-semibold text-slate-800">{m.product_name || "Unknown"}</div>
                              {m.sku && <div className="text-xs text-slate-400 font-mono">SKU: {m.sku}</div>}
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Volume Moved</div>
                              <div className="font-black text-emerald-600 font-mono">{m.quantity} Units</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Status</div>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                m.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}><CheckCircle2 className="size-3.5" /> {m.status}</span>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Route: From → To</div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-bold">{m.source_location}</span>
                                <ArrowRight className="size-3 text-slate-400" />
                                <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-bold">{m.destination_location}</span>
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Notes / Reason</div>
                              <div className="text-slate-600 text-xs leading-relaxed">{m.notes || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 uppercase font-bold mb-1">Date</div>
                              <div className="text-slate-600">{m.created_at ? new Date(m.created_at).toLocaleDateString("en-IN") : "—"}</div>
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
    </div>
  );
}
