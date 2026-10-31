import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { useCurrency } from "@/hooks/use-currency";
import { inventoryApi } from "@/lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Clock,
  Archive,
  Search,
  RefreshCw,
  Tag,
  ArrowRight,
  Maximize2,
  Minimize2,
  Download,
  LayoutGrid,
  Rows3,
  Copy,
  Check,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
  DollarSign,
  Boxes,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SlowMoving() {
  const { t } = useI18n();
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    items: any[];
    total_count: number;
    total_tied_capital: number;
    total_units_holding: number;
    avg_holding_value: number;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Full Screen Mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // View Mode: Cards vs Table
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    try {
      return (localStorage.getItem("slow_moving_view_mode") as "cards" | "table") || "table";
    } catch {
      return "table";
    }
  });

  const handleSetViewMode = (mode: "cards" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("slow_moving_view_mode", mode);
    } catch {}
  };

  // Table Sorting
  type SortField = "name" | "on_hand" | "stock_value" | "days_of_cover" | "movement_30d_qty" | "category";
  const [sortField, setSortField] = useState<SortField>("stock_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selected Items for Bulk Clearance
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getSlowMoving();
      setData(res);
    } catch (err: any) {
      console.error("Failed to load slow moving items:", err);
      toast.error(t("Failed to load slow moving inventory", "Failed to load slow moving inventory"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allItems: any[] = data?.items || [];
  const categories = Array.from(new Set(allItems.map((i) => i.category || "General")));

  const filteredItems = useMemo(() => {
    let result = allItems.filter((item) => {
      const matchesSearch =
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = categoryFilter === "all" || (item.category || "General") === categoryFilter;

      return matchesSearch && matchesCat;
    });

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toString().toLowerCase();
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = Number(aVal || 0);
      bVal = Number(bVal || 0);
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [allItems, searchQuery, categoryFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" || field === "category" ? "asc" : "desc");
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => String(i.id))));
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    toast.success(t("SKU copied to clipboard", "SKU copied to clipboard"));
    setTimeout(() => setCopiedSku(null), 1800);
  };

  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      toast.error(t("No items to export", "No items to export"));
      return;
    }
    const headers = [
      "Product Name",
      "SKU",
      "Category",
      "Stock on Hand",
      "Cost Price",
      "Tied Working Capital",
      "30-Day Movement",
      "90-Day Movement",
      "Days of Cover",
      "Suggested Action",
    ];
    const rows = filteredItems.map((item) => [
      `"${(item.name || "").replace(/"/g, '""')}"`,
      `"${item.sku || ""}"`,
      `"${item.category || "General"}"`,
      item.on_hand || 0,
      item.purchase_price || 0,
      item.stock_value || 0,
      item.movement_30d_qty || 0,
      item.movement_90d_qty || 0,
      item.days_of_cover != null ? item.days_of_cover : "N/A",
      '"Promotional Discount / Bundle"',
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Slow_Moving_Inventory_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("Exported slow moving report to CSV", "Exported slow moving report to CSV"));
  };

  return (
    <div
      className={cn(
        "space-y-5 w-full pb-12 px-1 sm:px-2 transition-all",
        isFullscreen && "p-4 sm:p-6 bg-background min-h-screen overflow-y-auto"
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/10 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("Slow Moving Inventory (Turnover Optimization)", "Slow Moving Inventory (Turnover Optimization)")}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
              Capital Efficiency
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "Identify dormant items and low-velocity inventory tying up storage capacity and working capital.",
              "Identify dormant items and low-velocity inventory tying up storage capacity and working capital."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground cursor-pointer flex items-center gap-1.5"
            title={isFullscreen ? "Exit Full Screen" : "Full Screen View"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span>{isFullscreen ? t("Exit Full Screen", "Exit Full Screen") : t("Full Screen", "Full Screen")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{t("Refresh", "Refresh")}</span>
          </Button>

          <a
            href="/inventory?tab=dead_stock"
            className="h-8 bg-amber-600 hover:bg-amber-700 text-white px-3 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Archive className="size-3.5" />
            <span>{t("View Dead Stock", "View Dead Stock")}</span>
          </a>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Total Tied Capital */}
        <div className="p-3 bg-card border border-amber-200/80 dark:border-amber-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">
              {t("Tied Working Capital", "Tied Working Capital")}
            </span>
            <div className="size-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {formatCurrency(data?.total_tied_capital ?? 0)}
            </span>
            <span className="text-[10px] font-semibold text-amber-600/80 truncate">
              Holding investment
            </span>
          </div>
        </div>

        {/* Slow Moving SKUs */}
        <div className="p-3 bg-card border border-orange-200/80 dark:border-orange-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider truncate">
              {t("Dormant Products", "Dormant Products")}
            </span>
            <div className="size-6 rounded-lg bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
              <Archive className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-orange-700 dark:text-orange-400 font-mono">
              {data?.total_count ?? allItems.length}
            </span>
            <span className="text-[10px] font-semibold text-orange-600/80 truncate">
              Low velocity SKUs
            </span>
          </div>
        </div>

        {/* Units in Holding */}
        <div className="p-3 bg-card border border-sky-200/80 dark:border-sky-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider truncate">
              {t("Units in Holding", "Units in Holding")}
            </span>
            <div className="size-6 rounded-lg bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
              <Boxes className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-sky-700 dark:text-sky-400 font-mono">
              {data?.total_units_holding ?? 0}
            </span>
            <span className="text-[10px] font-semibold text-sky-600/80 truncate">
              Occupying rack space
            </span>
          </div>
        </div>

        {/* Average Holding Value */}
        <div className="p-3 bg-card border border-purple-200/80 dark:border-purple-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider truncate">
              {t("Avg Value / SKU", "Avg Value / SKU")}
            </span>
            <div className="size-6 rounded-lg bg-purple-500/15 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-purple-700 dark:text-purple-400 font-mono">
              {formatCurrency(data?.avg_holding_value ?? 0)}
            </span>
            <span className="text-[10px] font-semibold text-purple-600/80 truncate">
              Per product average
            </span>
          </div>
        </div>

        {/* Turnover Horizon Target */}
        <div className="p-3 bg-card border border-rose-200/80 dark:border-rose-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider truncate">
              {t("Turnover Warning", "Turnover Warning")}
            </span>
            <div className="size-6 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono">
              &gt;60 <span className="text-xs font-normal text-muted-foreground">Days</span>
            </span>
            <span className="text-[10px] font-semibold text-rose-600/80 truncate">
              Excess days-of-cover
            </span>
          </div>
        </div>
      </div>

      {/* AI Strategy Banner */}
      <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800/40 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-950 dark:text-amber-200">
              {t("Turnover Acceleration & Markdown Strategy", "Turnover Acceleration & Markdown Strategy")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
              {t(
                "These products have stock on hand but low consumer velocity. Consider bundle promotions with bestsellers, cross-merchandising, or supplier returns before items progress to dead stock.",
                "These products have stock on hand but low consumer velocity. Consider bundle promotions with bestsellers, cross-merchandising, or supplier returns before items progress to dead stock."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        <div className="relative w-full lg:w-80">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search by product name, SKU, category...", "Search by product name, SKU, category...")}
            className="pl-9 bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs h-9 px-3 rounded-xl border border-border bg-card text-foreground font-semibold cursor-pointer shadow-2xs"
          >
            <option value="all">{t("All Categories", "All Categories")}</option>
            {categories.map((c: string) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer"
            title="Export slow moving items to CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">{t("Export CSV", "Export CSV")}</span>
          </Button>

          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => handleSetViewMode("cards")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "cards"
                  ? "bg-background text-primary shadow-xs border border-primary/20 font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Cards Grid View"
            >
              <LayoutGrid className="size-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "table"
                  ? "bg-background text-primary shadow-xs border border-primary/20 font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Spreadsheet Table View"
            >
              <Rows3 className="size-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedItemIds.size > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <span className="size-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              {selectedItemIds.size} {t("slow-moving product(s) selected", "slow-moving product(s) selected")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                toast.success(t(`Applied promotional discount to ${selectedItemIds.size} products!`, `Applied promotional discount to ${selectedItemIds.size} products!`));
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Tag className="size-3.5" />
              {t("Promotional Markdown", "Promotional Markdown")}
            </button>

            <a
              href={`/inventory?tab=stock_movement&product_ids=${Array.from(selectedItemIds).join(",")}`}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <ArrowRight className="size-3.5" />
              {t("Transfer / RTV", "Transfer / RTV")}
            </a>

            <button
              type="button"
              onClick={() => setSelectedItemIds(new Set())}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              {t("Clear", "Clear")}
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="border border-border/80 rounded-2xl overflow-hidden bg-card p-8">
          <div className="space-y-4">
            <div className="h-10 bg-muted/60 rounded-xl animate-pulse" />
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center border-dashed bg-card/50">
          <div className="mx-auto size-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="size-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {t("Healthy Inventory Turnover", "Healthy Inventory Turnover")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {searchQuery
              ? t("No products match your search filter.", "No products match your search filter.")
              : t("All products have active velocity within normal turnover horizons.", "All products have active velocity within normal turnover horizons.")}
          </p>
        </Card>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-sm flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/50 dark:bg-muted/20 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.size === filteredItems.length && filteredItems.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase"
                    >
                      <span>{t("Product & SKU", "Product & SKU")}</span>
                      {sortField === "name" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-amber-600" /> : <ArrowDown className="size-3 text-amber-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort("category")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase"
                    >
                      <span>{t("Category", "Category")}</span>
                      {sortField === "category" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-amber-600" /> : <ArrowDown className="size-3 text-amber-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("on_hand")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Stock on Hand", "Stock on Hand")}</span>
                      {sortField === "on_hand" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-amber-600" /> : <ArrowDown className="size-3 text-amber-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("stock_value")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Tied Capital", "Tied Capital")}</span>
                      {sortField === "stock_value" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-amber-600" /> : <ArrowDown className="size-3 text-amber-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("movement_30d_qty")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("30D Sales", "30D Sales")}</span>
                      {sortField === "movement_30d_qty" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-amber-600" /> : <ArrowDown className="size-3 text-amber-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("days_of_cover")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Days of Cover", "Days of Cover")}</span>
                      {sortField === "days_of_cover" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-amber-600" /> : <ArrowDown className="size-3 text-amber-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right w-48">{t("Recommended Action", "Recommended Action")}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const isSelected = selectedItemIds.has(String(item.id));

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "transition-colors group",
                        isSelected
                          ? "bg-amber-50/50 dark:bg-amber-950/20"
                          : idx % 2 === 0
                          ? "bg-card"
                          : "bg-muted/10",
                        "hover:bg-muted/40 dark:hover:bg-muted/20"
                      )}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleItem(String(item.id))}
                          className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 border bg-amber-500/10 text-amber-600 border-amber-500/20">
                            <Clock className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-foreground block truncate max-w-[320px]">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/80">
                                {item.sku || "N/A"}
                              </span>
                              {item.sku && (
                                <button
                                  type="button"
                                  onClick={() => handleCopySku(item.sku)}
                                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                                  title="Copy SKU"
                                >
                                  {copiedSku === item.sku ? (
                                    <Check className="size-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="size-3 opacity-60 hover:opacity-100" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-muted/80 px-2.5 py-1 rounded-md border border-border/60">
                          {item.category || "General"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-sm text-foreground font-mono">
                          {item.on_hand}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">units</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-sm text-amber-700 dark:text-amber-300 font-mono">
                        {formatCurrency(item.stock_value || 0)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-xs text-muted-foreground font-mono">
                          {item.movement_30d_qty || 0} u
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {item.days_of_cover != null ? (
                          <span
                            className={cn(
                              "inline-flex items-center font-bold text-xs px-2 py-0.5 rounded-md border",
                              item.days_of_cover >= 90
                                ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
                                : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                            )}
                          >
                            {item.days_of_cover}d
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">&gt;180d</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              toast.info(t(`Clearance markdown queued for ${item.name}`, `Clearance markdown queued for ${item.name}`));
                            }}
                            className="text-xs h-7 px-2.5 text-amber-600 border-amber-200 dark:border-amber-900 hover:bg-amber-50 cursor-pointer"
                          >
                            <Tag className="size-3 mr-1" />
                            <span>{t("Markdown", "Markdown")}</span>
                          </Button>

                          <a
                            href={`/inventory?tab=stock_movement&product_id=${item.id}`}
                            className="inline-flex items-center p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="View Stock Movement History"
                          >
                            <ArrowRight className="size-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-muted/30 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <span>
              {t("Showing", "Showing")}{" "}
              <strong className="text-foreground">{filteredItems.length}</strong>{" "}
              {t("slow moving products holding", "slow moving products holding")}{" "}
              <strong className="text-amber-600 font-bold">{formatCurrency(data?.total_tied_capital ?? 0)}</strong>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                <span>{data?.total_units_holding ?? 0} {t("Units in Storage", "Units in Storage")}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-5 transition-all hover:shadow-lg border-t-4 border-t-amber-500 bg-amber-500/[0.02]">
              <div className="flex justify-between items-start gap-2 mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                  {item.category || "General"}
                </span>
                <span className="text-xs font-bold text-amber-600 font-mono">
                  {item.days_of_cover != null ? `${item.days_of_cover}d cover` : ">180d cover"}
                </span>
              </div>

              <h3 className="font-bold text-sm text-foreground mb-1 truncate" title={item.name}>
                {item.name}
              </h3>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mb-4">
                <span>SKU: {item.sku || "N/A"}</span>
                {item.sku && (
                  <button
                    type="button"
                    onClick={() => handleCopySku(item.sku)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy SKU"
                  >
                    {copiedSku === item.sku ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3 opacity-60 hover:opacity-100" />
                    )}
                  </button>
                )}
              </div>

              <div className="bg-muted/40 dark:bg-muted/20 p-3.5 rounded-xl border border-dashed grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                    {t("Stock on Hand", "Stock on Hand")}
                  </div>
                  <div className="text-xl font-black text-foreground font-mono">
                    {item.on_hand} <span className="text-xs font-normal text-muted-foreground">units</span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                    {t("Tied Capital", "Tied Capital")}
                  </div>
                  <div className="text-xl font-black text-amber-600 font-mono">
                    {formatCurrency(item.stock_value || 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mb-4">
                <span className="text-muted-foreground">{t("30D Sales Activity:", "30D Sales Activity:")}</span>
                <span className="font-bold text-foreground font-mono">
                  {item.movement_30d_qty || 0} units
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toast.info(t(`Markdown promotion created for ${item.name}`, `Markdown promotion created for ${item.name}`));
                  }}
                  className="flex-1 text-xs h-9 px-2.5 text-amber-600 border-amber-200 dark:border-amber-900 hover:bg-amber-50 cursor-pointer"
                >
                  <Tag className="size-3.5 mr-1" />
                  <span>{t("Markdown Promo", "Markdown Promo")}</span>
                </Button>

                <a
                  href={`/inventory?tab=stock_movement&product_id=${item.id}`}
                  className="inline-flex items-center justify-center text-xs h-9 px-3 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="View Movement History"
                >
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
