import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { useCurrency } from "@/hooks/use-currency";
import { inventoryApi } from "@/lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Rocket,
  Flame,
  TrendingUp,
  Search,
  RefreshCw,
  ShoppingCart,
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
  ShieldCheck,
  DollarSign,
  Boxes,
  Zap,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FastMoving() {
  const { t } = useI18n();
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    items: any[];
    total_count: number;
    total_units_sold_30d: number;
    total_estimated_revenue_30d: number;
    total_stock_value: number;
    avg_daily_turnover: number;
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
      return (localStorage.getItem("fast_moving_view_mode") as "cards" | "table") || "table";
    } catch {
      return "table";
    }
  });

  const handleSetViewMode = (mode: "cards" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("fast_moving_view_mode", mode);
    } catch {}
  };

  // Table Sorting
  type SortField = "name" | "movement_30d_qty" | "on_hand" | "revenue" | "days_of_cover" | "category";
  const [sortField, setSortField] = useState<SortField>("movement_30d_qty");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getFastMoving();
      setData(res);
    } catch (err: any) {
      console.error("Failed to load fast moving items:", err);
      toast.error(t("Failed to load fast moving inventory", "Failed to load fast moving inventory"));
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

      if (sortField === "revenue") {
        aVal = (a.movement_30d_qty || 0) * (a.selling_price || 0);
        bVal = (b.movement_30d_qty || 0) * (b.selling_price || 0);
      }

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
      "30-Day Movement Qty",
      "Selling Price",
      "Est 30-Day Revenue",
      "Current Stock",
      "Days of Cover",
      "Daily Sales Rate",
    ];
    const rows = filteredItems.map((item) => {
      const daily = (item.movement_30d_qty || 0) / 30.0;
      const rev = (item.movement_30d_qty || 0) * (item.selling_price || 0);
      return [
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${item.sku || ""}"`,
        `"${item.category || "General"}"`,
        item.movement_30d_qty || 0,
        item.selling_price || 0,
        rev.toFixed(2),
        item.on_hand || 0,
        item.days_of_cover != null ? item.days_of_cover : "N/A",
        daily.toFixed(1),
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Fast_Moving_Inventory_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("Exported fast moving report to CSV", "Exported fast moving report to CSV"));
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
            <div className="p-1.5 bg-emerald-500/10 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <Rocket className="size-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("Fast Moving Inventory (Velocity Leaders)", "Fast Moving Inventory (Velocity Leaders)")}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
              High Velocity
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "Identify top sales performers and rapid-turnover products to protect stock availability and maximize revenue.",
              "Identify top sales performers and rapid-turnover products to protect stock availability and maximize revenue."
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
            href="/inventory?tab=reorder_planning"
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white px-3 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <TrendingUp className="size-3.5" />
            <span>{t("View Reorder Buffers", "View Reorder Buffers")}</span>
          </a>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Total 30-Day Movement Qty */}
        <div className="p-3 bg-card border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">
              {t("30D Sales Units", "30D Sales Units")}
            </span>
            <div className="size-6 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <Boxes className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              {data?.total_units_sold_30d ?? 0}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600/80 truncate">
              Units moved (30d)
            </span>
          </div>
        </div>

        {/* 30-Day Estimated Revenue */}
        <div className="p-3 bg-card border border-indigo-200/80 dark:border-indigo-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate">
              {t("30D Est. Revenue", "30D Est. Revenue")}
            </span>
            <div className="size-6 rounded-lg bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-400 font-mono">
              {formatCurrency(data?.total_estimated_revenue_30d ?? 0)}
            </span>
            <span className="text-[10px] font-semibold text-indigo-600/80 truncate">
              Gross revenue generated
            </span>
          </div>
        </div>

        {/* Daily Sales Run-rate */}
        <div className="p-3 bg-card border border-amber-200/80 dark:border-amber-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">
              {t("Daily Sales Run-rate", "Daily Sales Run-rate")}
            </span>
            <div className="size-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Zap className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {data?.avg_daily_turnover ?? 0} <span className="text-xs font-normal text-muted-foreground">u/day</span>
            </span>
            <span className="text-[10px] font-semibold text-amber-600/80 truncate">
              Average consumption
            </span>
          </div>
        </div>

        {/* Total High-Velocity SKUs */}
        <div className="p-3 bg-card border border-sky-200/80 dark:border-sky-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider truncate">
              {t("Active Fast Movers", "Active Fast Movers")}
            </span>
            <div className="size-6 rounded-lg bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
              <Flame className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-sky-700 dark:text-sky-400 font-mono">
              {data?.total_count ?? allItems.length}
            </span>
            <span className="text-[10px] font-semibold text-sky-600/80 truncate">
              Top velocity products
            </span>
          </div>
        </div>

        {/* Inventory Value in Fast Movers */}
        <div className="p-3 bg-card border border-purple-200/80 dark:border-purple-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider truncate">
              {t("Working Stock Value", "Working Stock Value")}
            </span>
            <div className="size-6 rounded-lg bg-purple-500/15 text-purple-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-purple-700 dark:text-purple-400 font-mono">
              {formatCurrency(data?.total_stock_value ?? 0)}
            </span>
            <span className="text-[10px] font-semibold text-purple-600/80 truncate">
              Capital in active SKUs
            </span>
          </div>
        </div>
      </div>

      {/* AI Strategy Banner */}
      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/40 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Flame className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
              {t("Revenue Engine Protection Strategy", "Revenue Engine Protection Strategy")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
              {t(
                "These items generate the highest sales volume and cash turnover. Maintain proactive lead-time buffer stock and negotiate vendor volume rebates to protect profit margins.",
                "These items generate the highest sales volume and cash turnover. Maintain proactive lead-time buffer stock and negotiate vendor volume rebates to protect profit margins."
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
            title="Export fast moving items to CSV"
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

      {/* Main Content Area */}
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
            {t("No Sales Movements Recorded Yet", "No Sales Movements Recorded Yet")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {t(
              "As cashiers ring up sales transactions or inventory transfers occur, fast-moving products will be ranked here by velocity.",
              "As cashiers ring up sales transactions or inventory transfers occur, fast-moving products will be ranked here by velocity."
            )}
          </p>
        </Card>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-sm flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/50 dark:bg-muted/20 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase"
                    >
                      <span>{t("Product & SKU", "Product & SKU")}</span>
                      {sortField === "name" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-emerald-600" /> : <ArrowDown className="size-3 text-emerald-600" />
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
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-emerald-600" /> : <ArrowDown className="size-3 text-emerald-600" />
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
                      <span>{t("30D Sales Qty", "30D Sales Qty")}</span>
                      {sortField === "movement_30d_qty" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-emerald-600" /> : <ArrowDown className="size-3 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("revenue")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("30D Revenue", "30D Revenue")}</span>
                      {sortField === "revenue" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-emerald-600" /> : <ArrowDown className="size-3 text-emerald-600" />
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
                      <span>{t("Current Stock", "Current Stock")}</span>
                      {sortField === "on_hand" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-emerald-600" /> : <ArrowDown className="size-3 text-emerald-600" />
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
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-emerald-600" /> : <ArrowDown className="size-3 text-emerald-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right w-44">{t("Actions", "Actions")}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const revenue = (item.movement_30d_qty || 0) * (item.selling_price || 0);
                  const isTop3 = idx < 3;

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "transition-colors group",
                        idx % 2 === 0 ? "bg-card" : "bg-muted/10",
                        "hover:bg-muted/40 dark:hover:bg-muted/20"
                      )}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center size-6 rounded-full text-[11px] font-black",
                            isTop3
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-mono"
                              : "text-muted-foreground font-mono"
                          )}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <Rocket className="size-4" />
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
                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                          {item.movement_30d_qty || 0}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">units</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-sm text-foreground font-mono">
                        {formatCurrency(revenue)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={cn(
                            "font-black text-sm font-mono",
                            item.on_hand <= (item.reorder_level || 5) ? "text-rose-600" : "text-foreground"
                          )}
                        >
                          {item.on_hand}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">units</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {item.days_of_cover != null ? (
                          <span
                            className={cn(
                              "inline-flex items-center font-black text-xs px-2.5 py-1 rounded-md border",
                              item.days_of_cover < 7
                                ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
                                : item.days_of_cover < 15
                                ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                                : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                            )}
                          >
                            {item.days_of_cover}d cover
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/procurement?action=create_po&product_id=${item.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                            title="Reorder Item"
                          >
                            <ShoppingCart className="size-3" />
                            <span>{t("Reorder", "Reorder")}</span>
                          </a>

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
              {t("fast moving products driving rapid sales turnover", "fast moving products driving rapid sales turnover")}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>{data?.total_units_sold_30d ?? 0} {t("Units Sold (30d)", "Units Sold (30d)")}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item, idx) => {
            const revenue = (item.movement_30d_qty || 0) * (item.selling_price || 0);

            return (
              <Card key={item.id} className="p-5 transition-all hover:shadow-lg border-t-4 border-t-emerald-500 bg-emerald-500/[0.02]">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                    {item.category || "General"}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">
                    #{idx + 1} {t("Velocity Rank", "Velocity Rank")}
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
                      {t("30D Sales Qty", "30D Sales Qty")}
                    </div>
                    <div className="text-xl font-black text-emerald-600 font-mono">
                      {item.movement_30d_qty || 0} <span className="text-xs font-normal text-muted-foreground">units</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                      {t("30D Revenue", "30D Revenue")}
                    </div>
                    <div className="text-xl font-black text-foreground font-mono">
                      {formatCurrency(revenue)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mb-4">
                  <span className="text-muted-foreground">{t("Current Stock:", "Current Stock:")}</span>
                  <span className="font-black text-foreground font-mono">
                    {item.on_hand} units
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <a
                    href={`/procurement?action=create_po&product_id=${item.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <ShoppingCart className="size-3.5" />
                    <span>{t("Reorder Buffer", "Reorder Buffer")}</span>
                  </a>

                  <a
                    href={`/inventory?tab=stock_movement&product_id=${item.id}`}
                    className="inline-flex items-center justify-center text-xs h-9 px-3 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="View Movement History"
                  >
                    <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
