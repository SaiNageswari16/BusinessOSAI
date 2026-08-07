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
  const [pageSize, setPageSize] = useState(50);
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
  const fetchList = async (targetPage = page, targetSize = pageSize) => {
    setIsLoadingList(true);
    try {
      const res = await inventoryApi.adminGetMasterCatalogList({
        page: targetPage,
        page_size: targetSize,
        search: searchQuery.trim() || undefined,
        rag_status: statusFilter !== "all" ? statusFilter : undefined
      });
      setItems(Array.isArray(res) ? res : (res?.items || []));
      setTotalItems(res.total || (Array.isArray(res) ? res.length : 0));

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

  // Combined fetch trigger on query, status filter, page, or page size change
  useEffect(() => {
    fetchList(page, pageSize);
  }, [page, pageSize, searchQuery, statusFilter]);

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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Global Master Catalog (Admin View)
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-blue-600 border border-blue-500/20">
              RAG Pipeline Control
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor, pause, resume, and audit specifications across the global product master data catalog.
          </p>
        </div>
      </div>

      {/* RAG Controller Panel */}
      <Card className="bg-card border-border p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-foreground ${
              ragStatus.paused ? "bg-blue-50 border border-blue-200" : "bg-blue-50 border border-blue-200"
            }`}>
              {ragStatus.paused ? <Pause className="w-5 h-5 text-blue-600 animate-pulse" /> : <Play className="w-5 h-5 text-blue-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">RAG Sourcing Pipeline Status:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  ragStatus.paused ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  {ragStatus.paused ? "PAUSED" : "ACTIVE & RUNNING"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ragStatus.paused ? "Background workers are idle. Click resume to restore parallel RAG web retrieval." : "Workers are actively pulling pending products in parallel batches."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePauseResume}
              className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                ragStatus.paused
                  ? "bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
                  : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              {ragStatus.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span>{ragStatus.paused ? "Resume Pipeline" : "Pause Sourcing"}</span>
            </button>

            <button
              onClick={handleTriggerBulkRAG}
              disabled={isTriggeringRAG}
              className="h-9 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-white" />
              <span>Queue All Barcodes</span>
            </button>
          </div>
        </div>

        {/* Counter cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
          <div className="bg-muted/50 p-4 rounded-xl border border-border text-center">
            <div className="text-xs text-muted-foreground font-medium">Total Products</div>
            <div className="text-2xl font-bold text-foreground mt-1">{ragStatus.total}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-xl border border-border text-center">
            <div className="text-xs text-muted-foreground font-medium">Pending Enrichment</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{ragStatus.pending}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-xl border border-border text-center">
            <div className="text-xs text-muted-foreground font-medium">Sourcing (Active)</div>
            <div className="text-2xl font-bold text-blue-600 mt-1 flex items-center justify-center gap-1.5">
              {ragStatus.processing > 0 && !ragStatus.paused && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              <span>{ragStatus.processing}</span>
            </div>
          </div>
          <div className="bg-muted/50 p-4 rounded-xl border border-border text-center">
            <div className="text-xs text-muted-foreground font-medium">Completed (Enriched)</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{ragStatus.completed}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-xl border border-border text-center col-span-2 md:col-span-1">
            <div className="text-xs text-muted-foreground font-medium">Failed Updates</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{ragStatus.failed}</div>
          </div>
        </div>

        {/* Progress gauge */}
        {ragStatus.total > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
              <span>System Sourcing Completion Rate</span>
              <span>{Math.round((ragStatus.completed / (ragStatus.total || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${(ragStatus.completed / (ragStatus.total || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Grid Controller Header */}
      <Card className="bg-card border-border p-6 space-y-6">
        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search master database by Name, Brand, or Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">RAG Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-xl text-xs font-medium text-foreground py-2.5 px-4 focus:outline-none focus:border-blue-500 cursor-pointer"
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
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-foreground flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span>Enrich Selected ({selectedProductIds.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Database Grid Table */}
        <div className="overflow-x-auto border border-border rounded-xl bg-card">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider bg-muted/50">
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
                    className="rounded border-border bg-background text-blue-600 focus:ring-indigo-500 w-3.5 h-3.5"
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
                  <td colSpan={9} className="py-16 text-center text-muted-foreground font-medium">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                    Loading Master Data Catalog...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground font-semibold">
                    No products found matching query filters.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-border/80 hover:bg-background/30 transition-colors">
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
                          className="rounded border-border bg-background text-blue-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-8 h-8 rounded-lg object-contain bg-background border border-border shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-slate-600 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="font-semibold text-foreground line-clamp-1">{item.name}</div>
                      {item.short_description ? (
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 italic">{item.short_description}</div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground mt-0.5">No specifications sourced yet</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                      {item.barcode || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {item.brand || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {item.category || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-max border ${
                          item.ai_search_done
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : item.rag_status === "processing"
                            ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                            : item.rag_status === "failed"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-600 border-border"
                        }`}>
                          {item.ai_search_done ? "Completed" : item.rag_status === "processing" ? "Sourcing" : item.rag_status === "failed" ? "Failed" : "Pending"}
                        </span>
                        {item.rag_status === "failed" && item.rag_error && (
                          <span className="text-[9px] text-blue-600 mt-0.5 max-w-[150px] truncate" title={item.rag_error}>
                            {item.rag_error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-foreground">
                      {item.mrp ? `₹${item.mrp.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.id && !item.ai_search_done && (
                        <button
                          onClick={() => handleTriggerSingleRAG(item.id!)}
                          disabled={item.rag_status === "processing"}
                          className="p-1.5 rounded-lg bg-background hover:bg-muted text-blue-600 border border-input disabled:opacity-50 transition"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span> to{" "}
                <span className="font-semibold text-foreground">{Math.min(page * pageSize, totalItems)}</span> of{" "}
                <span className="font-semibold text-foreground">{totalItems}</span> products
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-background border border-input rounded-md px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="w-8 h-8 rounded-lg border-input bg-background hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <span className="text-xs text-muted-foreground font-semibold">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="w-8 h-8 rounded-lg border-input bg-background hover:bg-accent hover:text-accent-foreground"
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
