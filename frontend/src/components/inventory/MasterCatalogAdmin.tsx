import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Search,
  Globe,
  Database,
  Plus,
  CheckCircle,
  Loader2,
  Sparkles,
  Barcode,
  Tag,
  Package,
  Layers,
  Building2,
  DollarSign,
  ShieldCheck,
  Zap,
  Info,
  Pause,
  Play,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

interface MasterCatalogItem {
  id?: string;
  name: string;
  brand?: string;
  barcode?: string;
  sku_code?: string;
  product_code?: string;
  hsn_code?: string;
  mrp?: number;
  cost_price?: number;
  sale_price?: number;
  category?: string;
  sub_category?: string;
  image_url?: string;
  short_description?: string;
  specifications?: string;
  ai_search_done?: boolean;
  rag_status?: string;
  rag_enriched_at?: string;
  rag_error?: string;
}

export function MasterCatalogAdmin() {
  const [items, setItems] = useState<MasterCatalogItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [ragStatus, setRagStatus] = useState({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0, paused: false });
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isTriggeringRAG, setIsTriggeringRAG] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Fetch status metrics
  const fetchStatus = async () => {
    try {
      const stats = await inventoryApi.getRAGEnrichmentStatus();
      setRagStatus({
        total: stats.total || 0,
        pending: stats.pending || 0,
        processing: stats.processing || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
        paused: !!stats.paused
      });
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  // Fetch list of master catalog products
  const fetchList = async () => {
    setIsLoadingList(true);
    try {
      const res = await inventoryApi.adminGetMasterCatalogList({
        page,
        page_size: pageSize,
        search: searchQuery.trim() || undefined,
        rag_status: statusFilter !== "all" ? statusFilter : undefined
      });
      setItems(res.items || []);
      setTotalItems(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch master catalog list");
    } finally {
      setIsLoadingList(false);
    }
  };

  // Auto-refresh stats periodically
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch list on filter or query change
  useEffect(() => {
    setPage(1);
    fetchList();
  }, [searchQuery, statusFilter]);

  // Fetch list on page change
  useEffect(() => {
    fetchList();
  }, [page]);

  const handlePauseResume = async () => {
    try {
      if (ragStatus.paused) {
        await inventoryApi.resumeRAGEnrichment();
        toast.success("RAG Catalog Sourcing loop resumed successfully!");
      } else {
        await inventoryApi.pauseRAGEnrichment();
        toast.success("RAG Catalog Sourcing loop paused successfully!");
      }
      fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to alter enrichment state");
    }
  };

  const handleTriggerBulkRAG = async () => {
    setIsTriggeringRAG(true);
    try {
      await inventoryApi.triggerRAGEnrichment(undefined, true);
      toast.success("All barcodes reset and enqueued for RAG enrichment.");
      fetchStatus();
      fetchList();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger bulk RAG enrichment");
    } finally {
      setIsTriggeringRAG(false);
    }
  };

  const handleTriggerSelectedRAG = async () => {
    if (selectedProductIds.length === 0) return;
    setIsTriggeringRAG(true);
    try {
      await inventoryApi.triggerRAGEnrichment(selectedProductIds, false);
      toast.success(`Enqueued ${selectedProductIds.length} items for processing.`);
      setSelectedProductIds([]);
      fetchStatus();
      fetchList();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger selected RAG enrichment");
    } finally {
      setIsTriggeringRAG(false);
    }
  };

  const handleTriggerSingleRAG = async (productId: string) => {
    try {
      await inventoryApi.triggerRAGEnrichment([productId], false);
      toast.success("Enqueued item for RAG web enrichment.");
      fetchStatus();
      fetchList();
    } catch (err: any) {
      toast.error(err.message || "Failed to enqueue product");
    }
  };

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            Global Master Catalog (Admin View)
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              RAG Pipeline Control
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor, pause, resume, and audit specifications across the global product master data catalog.
          </p>
        </div>
      </div>

      {/* RAG Controller Panel */}
      <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
              ragStatus.paused ? "bg-amber-600/20 border border-amber-500/40" : "bg-emerald-600/20 border border-emerald-500/40"
            }`}>
              {ragStatus.paused ? <Pause className="w-5 h-5 text-amber-400 animate-pulse" /> : <Play className="w-5 h-5 text-emerald-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">RAG Sourcing Pipeline Status:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  ragStatus.paused ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                }`}>
                  {ragStatus.paused ? "PAUSED" : "ACTIVE & RUNNING"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {ragStatus.paused ? "Background workers are idle. Click resume to restore parallel RAG web retrieval." : "Workers are actively pulling pending products in parallel batches."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePauseResume}
              className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                ragStatus.paused
                  ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
              }`}
            >
              {ragStatus.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span>{ragStatus.paused ? "Resume Pipeline" : "Pause Sourcing"}</span>
            </button>

            <button
              onClick={handleTriggerBulkRAG}
              disabled={isTriggeringRAG}
              className="h-9 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Queue All Barcodes</span>
            </button>
          </div>
        </div>

        {/* Counter cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center">
            <div className="text-xs text-slate-400 font-medium">Total Products</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{ragStatus.total}</div>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center">
            <div className="text-xs text-slate-400 font-medium">Pending Enrichment</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{ragStatus.pending}</div>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center">
            <div className="text-xs text-slate-400 font-medium">Sourcing (Active)</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1 flex items-center justify-center gap-1.5">
              {ragStatus.processing > 0 && !ragStatus.paused && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
              <span>{ragStatus.processing}</span>
            </div>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center">
            <div className="text-xs text-slate-400 font-medium">Completed (Enriched)</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{ragStatus.completed}</div>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center col-span-2 md:col-span-1">
            <div className="text-xs text-slate-400 font-medium">Failed Updates</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{ragStatus.failed}</div>
          </div>
        </div>

        {/* Progress gauge */}
        {ragStatus.total > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>System Sourcing Completion Rate</span>
              <span>{Math.round((ragStatus.completed / (ragStatus.total || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${(ragStatus.completed / (ragStatus.total || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Grid Controller Header */}
      <Card className="bg-slate-900 border-slate-800 p-6 space-y-6">
        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search master database by Name, Brand, or Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">RAG Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 py-2.5 px-4 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="enriched">AI Enriched (Completed)</option>
                <option value="pending">Pending AI</option>
                <option value="processing">Active Sourcing</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div>
            {selectedProductIds.length > 0 && (
              <button
                onClick={handleTriggerSelectedRAG}
                disabled={isTriggeringRAG}
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-indigo-650 hover:bg-indigo-600 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-indigo-300" />
                <span>Enrich Selected ({selectedProductIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Database Grid Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedProductIds.length === items.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProductIds(items.map(x => x.id!).filter(Boolean));
                      } else {
                        setSelectedProductIds([]);
                      }
                    }}
                    className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                </th>
                <th className="py-3 px-4 w-16">Image</th>
                <th className="py-3 px-4">Product details</th>
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">RAG Status</th>
                <th className="py-3 px-4 text-right">MRP (₹)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingList ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400 font-medium">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                    Loading Master Data Catalog...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500 font-semibold">
                    No products found matching query filters.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-slate-800/80 hover:bg-slate-900/30 transition-colors">
                    <td className="py-3.5 px-4 text-center">
                      {item.id && (
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(item.id)}
                          onChange={(e) => {
                            const id = item.id!;
                            if (e.target.checked) {
                              setSelectedProductIds(prev => [...prev, id]);
                            } else {
                              setSelectedProductIds(prev => prev.filter(x => x !== id));
                            }
                          }}
                          className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-8 h-8 rounded-lg object-contain bg-slate-900 border border-slate-800 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-semibold text-slate-200 line-clamp-1">{item.name}</div>
                      {item.short_description ? (
                        <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 italic">{item.short_description}</div>
                      ) : (
                        <div className="text-[10px] text-slate-500 mt-0.5">No specifications sourced yet</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {item.barcode || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {item.brand || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {item.category || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-max border ${
                          item.ai_search_done
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                            : item.rag_status === "processing"
                            ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/20 animate-pulse"
                            : item.rag_status === "failed"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-800"
                        }`}>
                          {item.ai_search_done ? "Completed" : item.rag_status === "processing" ? "Sourcing" : item.rag_status === "failed" ? "Failed" : "Pending"}
                        </span>
                        {item.rag_status === "failed" && item.rag_error && (
                          <span className="text-[9px] text-rose-400 mt-0.5 max-w-[150px] truncate" title={item.rag_error}>
                            {item.rag_error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-200">
                      {item.mrp ? `₹${item.mrp.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.id && !item.ai_search_done && (
                        <button
                          onClick={() => handleTriggerSingleRAG(item.id!)}
                          disabled={item.rag_status === "processing"}
                          className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-indigo-400 border border-slate-800 disabled:opacity-50 transition"
                          title="Trigger single item RAG enrichment"
                        >
                          {item.rag_status === "processing" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {!isLoadingList && totalItems > 0 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-200">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="font-semibold text-slate-200">{Math.min(page * pageSize, totalItems)}</span> of{" "}
              <span className="font-semibold text-slate-200">{totalItems}</span> products
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="w-8 h-8 rounded-lg border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <span className="text-xs text-slate-300 font-semibold">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="w-8 h-8 rounded-lg border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
