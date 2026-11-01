import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { useCurrency } from "@/hooks/use-currency";
import { inventoryApi, inventoryAlertsApi, ReorderItem } from "@/lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  TrendingUp,
  ShoppingCart,
  Sparkles,
  Search,
  RefreshCw,
  Send,
  MessageSquare,
  AlertTriangle,
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
  ShieldCheck,
  PackageOpen,
  DollarSign,
  PackageX,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function ReorderPlanning() {
  const { t } = useI18n();
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    items: ReorderItem[];
    total_count: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    estimated_total_value: number;
  } | null>(null);

  const [managerPhone, setManagerPhone] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
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
      return (localStorage.getItem("reorder_planning_view_mode") as "cards" | "table") || "table";
    } catch {
      return "table";
    }
  });

  const handleSetViewMode = (mode: "cards" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("reorder_planning_view_mode", mode);
    } catch {}
  };

  // Table Sorting
  type SortField = "name" | "urgency" | "on_hand" | "suggested_order_qty" | "suggested_order_value" | "category";
  const [sortField, setSortField] = useState<SortField>("urgency");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selected Items for Bulk PO
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const loadReorderData = useCallback(async () => {
    setLoading(true);
    try {
      const [recsRes, configRes] = await Promise.all([
        inventoryApi.getReorderRecommendations(),
        inventoryAlertsApi.getConfig().catch(() => null),
      ]);

      setData(recsRes);
      if (configRes?.config?.manager_whatsapp) {
        setManagerPhone(configRes.config.manager_whatsapp);
      }
    } catch (err: any) {
      console.error("Failed to load reorder recommendations:", err);
      toast.error(t("Failed to load reorder recommendations", "Failed to load reorder recommendations"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadReorderData();
  }, [loadReorderData]);

  const allItems: ReorderItem[] = data?.items || [];
  const categories = Array.from(new Set(allItems.map((i) => i.category || "General")));

  const URGENCY_WEIGHT: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const filteredItems = useMemo(() => {
    let result = allItems.filter((item) => {
      const matchesSearch =
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority = priorityFilter === "all" || item.urgency === priorityFilter;
      const matchesCat = categoryFilter === "all" || (item.category || "General") === categoryFilter;

      return matchesSearch && matchesPriority && matchesCat;
    });

    result.sort((a, b) => {
      if (sortField === "urgency") {
        const aWeight = URGENCY_WEIGHT[a.urgency] || 0;
        const bWeight = URGENCY_WEIGHT[b.urgency] || 0;
        return sortDirection === "asc" ? aWeight - bWeight : bWeight - aWeight;
      }

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
  }, [allItems, searchQuery, priorityFilter, categoryFilter, sortField, sortDirection]);

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
      "Urgency",
      "Current Stock",
      "Reorder Point",
      "Suggested Order Qty",
      "Estimated Order Value",
      "Recommendation Reason",
    ];
    const rows = filteredItems.map((item) => [
      `"${(item.name || "").replace(/"/g, '""')}"`,
      `"${item.sku || ""}"`,
      `"${item.category || "General"}"`,
      `"${item.urgency.toUpperCase()}"`,
      item.on_hand,
      item.reorder_level,
      item.suggested_order_qty,
      item.suggested_order_value || 0,
      `"${(item.reason || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reorder_Planning_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("Exported reorder planning report to CSV", "Exported reorder planning report to CSV"));
  };

  const handleSendSingleWhatsApp = async (item: ReorderItem) => {
    if (!managerPhone) {
      toast.error(t("Set a Manager WhatsApp phone number in Low Stock Settings first.", "Set a Manager WhatsApp phone number in Low Stock Settings first."));
      return;
    }
    try {
      await inventoryAlertsApi.testWhatsApp({
        phone_number: managerPhone,
        custom_message: `📦 *PO Reorder Recommendation:*\n\n• Product: *${item.name}*\n• SKU: \`${item.sku || "N/A"}\`\n• Priority: *${item.urgency.toUpperCase()}*\n• Current Stock: *${item.on_hand} units* (Reorder Point: ${item.reorder_level})\n• Suggested PO Qty: *${item.suggested_order_qty} units*\n• Estimated PO Cost: *₹${(item.suggested_order_value || 0).toLocaleString()}*\n• Reason: ${item.reason}\n\nPlease issue purchase order promptly.`,
      });
      toast.success(t("Dispatched reorder notification to WhatsApp!", "Dispatched reorder notification to WhatsApp!"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp alert");
    }
  };

  const handleSendSelectedWhatsApp = async () => {
    const selected = filteredItems.filter((i) => selectedItemIds.has(String(i.id)));
    if (selected.length === 0) return;
    if (!managerPhone) {
      toast.error(t("Set a Manager WhatsApp phone number in Low Stock Settings first.", "Set a Manager WhatsApp phone number in Low Stock Settings first."));
      return;
    }
    const lines = selected
      .slice(0, 10)
      .map(
        (it, idx) =>
          `${idx + 1}. *${it.name}* (${it.sku}): Stock ${it.on_hand}u → *Order +${it.suggested_order_qty}u* (Est: ₹${Math.round(it.suggested_order_value || 0).toLocaleString()})`
      )
      .join("\n");
    const totalEst = selected.reduce((sum, i) => sum + (i.suggested_order_value || 0), 0);

    try {
      await inventoryAlertsApi.testWhatsApp({
        phone_number: managerPhone,
        custom_message: `📦 *Bulk Reorder Plan (${selected.length} items):*\n\n${lines}${selected.length > 10 ? `\n...and ${selected.length - 10} more items` : ""}\n\n*Total Estimated PO Value:* ₹${Math.round(totalEst).toLocaleString()}\n\nPlease issue purchase orders for these procurement items.`,
      });
      toast.success(t("Dispatched bulk reorder digest to WhatsApp!", "Dispatched bulk reorder digest to WhatsApp!"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp digest");
    }
  };

  const criticalCount = data?.critical ?? allItems.filter((i) => i.urgency === "critical").length;
  const highCount = data?.high ?? allItems.filter((i) => i.urgency === "high").length;
  const mediumCount = data?.medium ?? allItems.filter((i) => i.urgency === "medium").length;
  const lowCount = data?.low ?? allItems.filter((i) => i.urgency === "low").length;
  const totalEstimatedVal = data?.estimated_total_value ?? allItems.reduce((acc, curr) => acc + (curr.suggested_order_value || 0), 0);

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
            <div className="p-1.5 bg-indigo-500/10 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="size-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("Reorder Planning & PO Suggestions", "Reorder Planning & PO Suggestions")}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
              AI Replenishment
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "AI suggested purchase orders based on Economic Order Quantity (EOQ), consumption velocity, and safety thresholds.",
              "AI suggested purchase orders based on Economic Order Quantity (EOQ), consumption velocity, and safety thresholds."
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
            onClick={loadReorderData}
            disabled={loading}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{t("Refresh", "Refresh")}</span>
          </Button>

          <a
            href={`/procurement?action=create_po&product_ids=${filteredItems.slice(0, 15).map((i) => i.id).join(",")}`}
            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <ShoppingCart className="size-3.5" />
            <span>{t("Create PO for All High Priority", "Create PO for All High Priority")}</span>
          </a>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Total Estimated PO Value */}
        <div className="p-3 bg-card border border-indigo-200/80 dark:border-indigo-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate">
              {t("Estimated PO Value", "Estimated PO Value")}
            </span>
            <div className="size-6 rounded-lg bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-400 font-mono">
              {formatCurrency(totalEstimatedVal)}
            </span>
            <span className="text-[10px] font-semibold text-indigo-600/80 truncate">
              Estimated procurement
            </span>
          </div>
        </div>

        {/* Critical Reorders */}
        <div className="p-3 bg-card border border-rose-200/80 dark:border-rose-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider truncate">
              {t("Critical Reorders", "Critical Reorders")}
            </span>
            <div className="size-6 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
              <PackageX className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono">
              {criticalCount}
            </span>
            <span className="text-[10px] font-semibold text-rose-600/80 truncate">
              Immediate PO needed
            </span>
          </div>
        </div>

        {/* High & Medium Reorders */}
        <div className="p-3 bg-card border border-amber-200/80 dark:border-amber-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">
              {t("Buffer Depleting", "Buffer Depleting")}
            </span>
            <div className="size-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <PackageOpen className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {highCount + mediumCount}
            </span>
            <span className="text-[10px] font-semibold text-amber-600/80 truncate">
              High / Medium priority
            </span>
          </div>
        </div>

        {/* Total Recommendations */}
        <div className="p-3 bg-card border border-sky-200/80 dark:border-sky-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider truncate">
              {t("Total Reorder SKUs", "Total Reorder SKUs")}
            </span>
            <div className="size-6 rounded-lg bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-sky-700 dark:text-sky-400 font-mono">
              {data?.total_count ?? allItems.length}
            </span>
            <span className="text-[10px] font-semibold text-sky-600/80 truncate">
              Active replenishment signals
            </span>
          </div>
        </div>

        {/* Days of Cover Target */}
        <div className="p-3 bg-card border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">
              {t("Lead Time Buffer", "Lead Time Buffer")}
            </span>
            <div className="size-6 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              7–14 <span className="text-xs font-normal text-muted-foreground">Days</span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-600/80 truncate">
              EOQ safety horizon
            </span>
          </div>
        </div>
      </div>

      {/* AI Replenishment Banner */}
      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
              {t("Dynamic EOQ & Consumption-Aware Planning", "Dynamic EOQ & Consumption-Aware Planning")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
              {t(
                "Suggested order quantities evaluate rolling 30-day velocity, lead-time safety buffers, and minimum lot sizes to prevent expensive stock-outs while optimizing holding capital.",
                "Suggested order quantities evaluate rolling 30-day velocity, lead-time safety buffers, and minimum lot sizes to prevent expensive stock-outs while optimizing holding capital."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & View Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        {/* Left: Search input */}
        <div className="relative w-full lg:w-80">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search by product name, SKU, category...", "Search by product name, SKU, category...")}
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Center: Priority Filter Pills & Category Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
            <Button
              size="sm"
              variant={priorityFilter === "all" ? "default" : "ghost"}
              onClick={() => setPriorityFilter("all")}
              className="text-xs h-7 px-2.5 rounded-lg font-bold cursor-pointer"
            >
              {t("All", "All")} ({allItems.length})
            </Button>
            <Button
              size="sm"
              variant={priorityFilter === "critical" ? "default" : "ghost"}
              onClick={() => setPriorityFilter("critical")}
              className={cn(
                "text-xs h-7 px-2.5 rounded-lg font-bold cursor-pointer",
                priorityFilter === "critical" ? "bg-rose-600 text-white" : "text-rose-600"
              )}
            >
              {t("Critical", "Critical")} ({criticalCount})
            </Button>
            <Button
              size="sm"
              variant={priorityFilter === "high" ? "default" : "ghost"}
              onClick={() => setPriorityFilter("high")}
              className={cn(
                "text-xs h-7 px-2.5 rounded-lg font-bold cursor-pointer",
                priorityFilter === "high" ? "bg-orange-600 text-white" : "text-orange-600"
              )}
            >
              {t("High", "High")} ({highCount})
            </Button>
            <Button
              size="sm"
              variant={priorityFilter === "medium" ? "default" : "ghost"}
              onClick={() => setPriorityFilter("medium")}
              className={cn(
                "text-xs h-7 px-2.5 rounded-lg font-bold cursor-pointer",
                priorityFilter === "medium" ? "bg-amber-600 text-white" : "text-amber-600"
              )}
            >
              {t("Medium", "Medium")} ({mediumCount})
            </Button>
          </div>

          {/* Category Dropdown */}
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

        {/* Right: Export CSV & View Mode Switcher */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer"
            title="Export reorder items to CSV"
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
            <span className="size-2 rounded-full bg-indigo-400 animate-ping" />
            <span>
              {selectedItemIds.size} {t("product(s) selected for procurement reorder", "product(s) selected for procurement reorder")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/procurement?action=create_po&product_ids=${Array.from(selectedItemIds).join(",")}`}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <ShoppingCart className="size-3.5" />
              {t("Create Bulk PO", "Create Bulk PO")}
            </a>

            <button
              type="button"
              onClick={handleSendSelectedWhatsApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <MessageSquare className="size-3.5" />
              {t("Send WhatsApp for Selected", "Send WhatsApp for Selected")}
            </button>

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
            {t("All Stocked Up", "All Stocked Up")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {searchQuery
              ? t("No reorder recommendations match your filter criteria.", "No reorder recommendations match your filter criteria.")
              : t("All inventory levels are safely above replenishment points.", "All inventory levels are safely above replenishment points.")}
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
                      onClick={() => handleSort("urgency")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase"
                    >
                      <span>{t("Priority", "Priority")}</span>
                      {sortField === "urgency" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase"
                    >
                      <span>{t("Product & SKU", "Product & SKU")}</span>
                      {sortField === "name" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
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
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
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
                      <span>{t("On Hand", "On Hand")}</span>
                      {sortField === "on_hand" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">{t("Reorder @", "Reorder @")}</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("suggested_order_qty")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Suggested Order", "Suggested Order")}</span>
                      {sortField === "suggested_order_qty" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("suggested_order_value")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Est. PO Value", "Est. PO Value")}</span>
                      {sortField === "suggested_order_value" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">{t("Trigger Reason", "Trigger Reason")}</th>
                  <th className="py-3 px-4 text-right w-44">{t("Quick Actions", "Quick Actions")}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const isSelected = selectedItemIds.has(String(item.id));
                  const isCritical = item.urgency === "critical";
                  const isHigh = item.urgency === "high";

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "transition-colors group",
                        isSelected
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20"
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
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border",
                            isCritical
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : isHigh
                              ? "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              isCritical ? "bg-rose-600 animate-pulse" : isHigh ? "bg-orange-500" : "bg-amber-500"
                            )}
                          />
                          {item.urgency}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "size-9 rounded-xl flex items-center justify-center shrink-0 border",
                              isCritical
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            )}
                          >
                            {isCritical ? <PackageX className="size-4" /> : <PackageOpen className="size-4" />}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-foreground block truncate max-w-[280px]">
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
                        <span className={cn("font-black text-sm font-mono", item.on_hand <= 0 ? "text-rose-600" : "text-amber-600")}>
                          {item.on_hand}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-xs text-muted-foreground font-mono">
                          {item.reorder_level}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center font-black text-xs px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                          +{item.suggested_order_qty}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-sm text-foreground font-mono">
                        {formatCurrency(item.suggested_order_value || 0)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-[11px] text-muted-foreground max-w-[220px] block truncate" title={item.reason}>
                          {item.reason}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/procurement?action=create_po&product_id=${item.id}&quantity=${item.suggested_order_qty}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                            title="Create Purchase Order"
                          >
                            <ShoppingCart className="size-3" />
                            <span>{t("Create PO", "Create PO")}</span>
                          </a>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendSingleWhatsApp(item)}
                            className="size-7 p-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            title="Dispatch WhatsApp Alert"
                          >
                            <MessageSquare className="size-3.5" />
                          </Button>
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
              {t("replenishment suggestions totalling", "replenishment suggestions totalling")}{" "}
              <strong className="text-indigo-600 font-bold">{formatCurrency(totalEstimatedVal)}</strong>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                <span>{criticalCount} {t("Critical", "Critical")}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                <span>{highCount + mediumCount} {t("Secondary", "Secondary")}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const isCritical = item.urgency === "critical";

            return (
              <Card
                key={item.id}
                className={cn(
                  "p-5 transition-all hover:shadow-lg border-t-4",
                  isCritical ? "border-t-rose-500 bg-rose-500/[0.02]" : "border-t-indigo-500 bg-indigo-500/[0.02]"
                )}
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                    {item.category || "General"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded",
                      isCritical ? "bg-rose-100 text-rose-700" : "bg-indigo-100 text-indigo-700"
                    )}
                  >
                    {item.urgency}
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
                      {t("Current Stock", "Current Stock")}
                    </div>
                    <div className={cn("text-xl font-black font-mono", item.on_hand <= 0 ? "text-rose-600" : "text-amber-600")}>
                      {item.on_hand} <span className="text-xs font-normal text-muted-foreground">units</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                      {t("Suggested Order", "Suggested Order")}
                    </div>
                    <div className="text-xl font-black text-indigo-600 font-mono">
                      +{item.suggested_order_qty} <span className="text-xs font-normal text-muted-foreground">units</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mb-4">
                  <span className="text-muted-foreground">{t("Est. Order Value:", "Est. Order Value:")}</span>
                  <span className="font-black text-foreground font-mono text-sm">
                    {formatCurrency(item.suggested_order_value || 0)}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2 mb-4 bg-muted/30 p-2 rounded-lg">
                  {item.reason}
                </p>

                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <a
                    href={`/procurement?action=create_po&product_id=${item.id}&quantity=${item.suggested_order_qty}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <ShoppingCart className="size-3.5" />
                    <span>{t("Create PO", "Create PO")}</span>
                  </a>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendSingleWhatsApp(item)}
                    className="size-9 p-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                    title="Send WhatsApp Alert"
                  >
                    <MessageSquare className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
