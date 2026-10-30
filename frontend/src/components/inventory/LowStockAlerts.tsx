import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { useCurrency } from "@/hooks/use-currency";
import { inventoryAlertsApi } from "@/lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  AlertTriangle,
  ShoppingCart,
  Sparkles,
  Search,
  Bell,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Send,
  Zap,
  PackageX,
  PackageOpen,
  ArrowUpRight,
  ShieldCheck,
  Smartphone,
  PhoneCall,
  History,
  Clock,
  X,
  Radio,
  Filter,
  LayoutGrid,
  Rows3,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  ExternalLink,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function LowStockAlerts() {
  const { t } = useI18n();
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    low_stock_push: true,
    low_stock_whatsapp: true,
    dead_stock_push: true,
    dead_stock_whatsapp: true,
    dead_stock_days: 90,
    manager_whatsapp: "",
  });
  const [waConnected, setWaConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
  const [activeFilter, setActiveFilter] = useState<"all" | "stockout" | "low_stock">("all");

  // View Mode: Cards vs Table (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    try {
      return (localStorage.getItem("low_stock_view_mode") as "cards" | "table") || "table";
    } catch {
      return "table";
    }
  });

  const handleSetViewMode = (mode: "cards" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("low_stock_view_mode", mode);
    } catch {}
  };

  // Table Sorting
  type SortField = "name" | "stock" | "reorder_level" | "deficit" | "status" | "category";
  const [sortField, setSortField] = useState<SortField>("deficit");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selected Items for Bulk PO / Alerts
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingWa, setTestingWa] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  // Alert History tracking & filtering
  const [historyPeriod, setHistoryPeriod] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [historyChannel, setHistoryChannel] = useState<"all" | "whatsapp" | "in_app">("all");
  const [historyData, setHistoryData] = useState<{
    summary: { total: number; in_app: number; whatsapp: number };
    alerts: Array<{ id: string; title: string; body: string; category: string; channel: "in_app" | "whatsapp"; created_at: string }>;
  }>({
    summary: { total: 0, in_app: 0, whatsapp: 0 },
    alerts: [],
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const loadHistory = useCallback(async (period = historyPeriod, channel = historyChannel) => {
    setHistoryLoading(true);
    try {
      const res = await inventoryAlertsApi.getAlertHistory(period, channel);
      if (res && res.summary) {
        setHistoryData(res);
      }
    } catch (err) {
      console.error("Failed to load alert history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPeriod, historyChannel]);

  const loadAlertData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        inventoryAlertsApi.getStatus(),
        inventoryAlertsApi.getConfig(),
      ]);
      setData(statusRes);
      if (configRes && configRes.config) {
        setConfig(configRes.config);
        setWaConnected(configRes.whatsapp_connected);
      }
      loadHistory();
    } catch (err: any) {
      console.error("Failed to load inventory alerts:", err);
      toast.error(t("Failed to load real-time stock alerts", "Failed to load real-time stock alerts"));
    } finally {
      setLoading(false);
    }
  }, [t, loadHistory]);

  useEffect(() => {
    loadAlertData();
  }, [loadAlertData]);

  useEffect(() => {
    loadHistory(historyPeriod, historyChannel);
  }, [historyPeriod, historyChannel, loadHistory]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await inventoryAlertsApi.updateConfig(config);
      toast.success(t("Alerting preferences saved successfully!", "Alerting preferences saved successfully!"));
      setShowConfigModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!config.manager_whatsapp) {
      toast.error(t("Please enter a manager WhatsApp phone number first.", "Please enter a manager WhatsApp phone number first."));
      return;
    }
    setTestingWa(true);
    try {
      const res = await inventoryAlertsApi.testWhatsApp({
        phone_number: config.manager_whatsapp,
      });
      toast.success(res.message || "Test WhatsApp message sent successfully!");
      loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send test WhatsApp message. Check Gateway connection.");
    } finally {
      setTestingWa(false);
    }
  };

  const handleSendDigestNow = async () => {
    setSendingDigest(true);
    try {
      const res = await inventoryAlertsApi.triggerDigest(config.manager_whatsapp);
      if (res.whatsapp_delivery?.success) {
        toast.success(t("Stock Health Digest sent via Push & WhatsApp!", "Stock Health Digest sent via Push & WhatsApp!"));
      } else {
        toast.success(t("In-App alert digest published! (WhatsApp: not configured or offline)", "In-App alert digest published! (WhatsApp: not configured or offline)"));
      }
      loadAlertData();
      loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Failed to trigger stock digest");
    } finally {
      setSendingDigest(false);
    }
  };

  const stockouts = data?.stockout_items || [];
  const lowStock = data?.low_stock_items || [];
  const combinedList = useMemo(() => [
    ...stockouts.map((i: any) => ({ ...i, isStockout: true })),
    ...lowStock.map((i: any) => ({ ...i, isStockout: false })),
  ], [stockouts, lowStock]);

  const filteredItems = useMemo(() => {
    let items = combinedList.filter((item) => {
      const matchesSearch =
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeFilter === "stockout") return matchesSearch && item.isStockout;
      if (activeFilter === "low_stock") return matchesSearch && !item.isStockout;
      return matchesSearch;
    });

    // Sort items
    items.sort((a, b) => {
      let result = 0;
      const deficitA = Math.max(0, (a.reorder_level || 0) - (a.stock || 0));
      const deficitB = Math.max(0, (b.reorder_level || 0) - (b.stock || 0));

      switch (sortField) {
        case "name":
          result = (a.name || "").localeCompare(b.name || "");
          break;
        case "category":
          result = (a.category || "").localeCompare(b.category || "");
          break;
        case "stock":
          result = (a.stock || 0) - (b.stock || 0);
          break;
        case "reorder_level":
          result = (a.reorder_level || 0) - (b.reorder_level || 0);
          break;
        case "deficit":
          result = deficitA - deficitB;
          break;
        case "status":
          result = (a.isStockout === b.isStockout ? 0 : a.isStockout ? -1 : 1);
          break;
        default:
          result = 0;
      }
      return sortDirection === "asc" ? result : -result;
    });

    return items;
  }, [combinedList, searchQuery, activeFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "deficit" || field === "stock" ? "asc" : "desc");
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
    if (!sku) return;
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    toast.success(`Copied SKU "${sku}" to clipboard`);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  const handleDispatchWhatsAppForProduct = async (item: any) => {
    if (!config.manager_whatsapp) {
      toast.error(t("Set WhatsApp number in Settings first.", "Set WhatsApp number in Settings first."));
      return;
    }
    try {
      await inventoryAlertsApi.testWhatsApp({
        phone_number: config.manager_whatsapp,
        custom_message: `🚨 *Urgent Stock Reorder Alert:*\nItem: *${item.name}* (SKU: ${item.sku})\nCurrent Stock: *${item.stock} ${item.unit || "pcs"}*\nMin Reorder Point: *${item.reorder_level} ${item.unit || "pcs"}*\nStatus: ${item.isStockout ? "OUT OF STOCK" : "LOW STOCK"}\nPlease issue purchase order.`,
      });
      toast.success(t("WhatsApp alert dispatched for this product!", "WhatsApp alert dispatched for this product!"));
      loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp alert");
    }
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
      "Alert Status",
      "Current Stock",
      "Min Reorder Level",
      "Units Needed (Deficit)",
      "Unit",
      "Estimated Cost",
    ];
    const rows = filteredItems.map((item) => {
      const deficit = Math.max(0, (item.reorder_level || 0) - (item.stock || 0));
      return [
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${item.sku || ""}"`,
        `"${item.category || "General"}"`,
        `"${item.isStockout ? "OUT OF STOCK" : "LOW STOCK"}"`,
        item.stock,
        item.reorder_level || 0,
        deficit,
        `"${item.unit || "pcs"}"`,
        item.cost_price || 0,
      ].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Low_Stock_Alerts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("Exported low stock report to CSV", "Exported low stock report to CSV"));
  };

  return (
    <div className={cn("space-y-5 w-full pb-12 px-1 sm:px-2 transition-all", isFullscreen && "p-4 sm:p-6 bg-background min-h-screen overflow-y-auto")}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/40 text-rose-400">
              <AlertTriangle className="size-6 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t("Low Stock & Reorder Alert Center", "Low Stock & Reorder Alert Center")}
            </h2>
          </div>
          <p className="text-slate-300 text-sm">
            {t(
              "Real-time replenishment monitoring with automated In-App Push and WhatsApp alerts to store managers.",
              "Real-time replenishment monitoring with automated In-App Push and WhatsApp alerts to store managers."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold cursor-pointer"
            title={isFullscreen ? "Exit Full Screen" : "Full Screen View"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5 mr-1.5" /> : <Maximize2 className="size-3.5 mr-1.5" />}
            {isFullscreen ? t("Exit Full Screen", "Exit Full Screen") : t("Full Screen", "Full Screen")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAlertData}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {t("Refresh", "Refresh")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border-indigo-500/40 text-xs font-semibold cursor-pointer"
          >
            <Sliders className="size-3.5 mr-1.5" />
            {t("Alert Settings & WhatsApp", "Alert Settings & WhatsApp")}
          </Button>

          <Button
            size="sm"
            onClick={handleSendDigestNow}
            disabled={sendingDigest}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg text-xs font-semibold cursor-pointer"
          >
            <Send className={`size-3.5 mr-1.5 ${sendingDigest ? "animate-spin" : ""}`} />
            {t("Broadcast WhatsApp Digest", "Broadcast WhatsApp Digest")}
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-200 dark:border-rose-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                {t("Critical Stockouts", "Critical Stockouts")}
              </p>
              <h3 className="text-3xl font-black text-rose-700 dark:text-rose-300 mt-1">
                {data?.summary?.stockout_count ?? 0}
              </h3>
            </div>
            <div className="p-2.5 bg-rose-500/20 text-rose-600 rounded-xl">
              <PackageX className="size-5" />
            </div>
          </div>
          <p className="text-xs text-rose-600/80 mt-2 flex items-center gap-1">
            <span className="font-bold">0 units remaining</span> — requires instant supplier PO
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200 dark:border-amber-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {t("Low Stock (Below Reorder)", "Low Stock (Below Reorder)")}
              </p>
              <h3 className="text-3xl font-black text-amber-700 dark:text-amber-300 mt-1">
                {data?.summary?.low_stock_count ?? 0}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/20 text-amber-600 rounded-xl">
              <PackageOpen className="size-5" />
            </div>
          </div>
          <p className="text-xs text-amber-600/80 mt-2">
            Items near minimum safe threshold
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200 dark:border-emerald-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {t("WhatsApp Alert Dispatch", "WhatsApp Alert Dispatch")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-block size-2.5 rounded-full ${config.low_stock_whatsapp && config.manager_whatsapp ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200">
                  {config.low_stock_whatsapp && config.manager_whatsapp ? "Active" : "Unconfigured"}
                </h3>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-500/20 text-emerald-600 rounded-xl">
              <MessageSquare className="size-5" />
            </div>
          </div>
          <p className="text-xs text-emerald-600/80 mt-2 truncate">
            {config.manager_whatsapp ? `Target: ${config.manager_whatsapp}` : "Set number in settings"}
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-200 dark:border-indigo-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {t("Total Monitored SKUs", "Total Monitored SKUs")}
              </p>
              <h3 className="text-3xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                {data?.summary?.total_products ?? 0}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-500/20 text-indigo-600 rounded-xl">
              <ShieldCheck className="size-5" />
            </div>
          </div>
          <p className="text-xs text-indigo-600/80 mt-2">
            Auto-checked on every POS sale & transfer
          </p>
        </Card>

        {/* Total Alerts Dispatched Card */}
        <Card className="p-4 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border-violet-200 dark:border-violet-900/40 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                  {t("Alerts Dispatched", "Alerts Dispatched")}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-black text-violet-700 dark:text-violet-300">
                    {historyLoading ? "..." : (historyData?.summary?.total ?? 0)}
                  </h3>
                  <span className="text-[11px] font-semibold text-violet-600/80">
                    {historyPeriod === "today" ? "today" : historyPeriod === "7d" ? "7d" : historyPeriod === "30d" ? "30d" : "all"}
                  </span>
                </div>
              </div>
              <div className="p-2.5 bg-violet-500/20 text-violet-600 rounded-xl">
                <Radio className="size-5" />
              </div>
            </div>

            {/* Micro Filter segmented pills */}
            <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-violet-100 dark:border-violet-900/30">
              {(["today", "7d", "30d", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setHistoryPeriod(p)}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    historyPeriod === p
                      ? "bg-violet-600 text-white shadow-xs"
                      : "bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20"
                  }`}
                >
                  {p === "today" ? "Today" : p === "7d" ? "7D" : p === "30d" ? "30D" : "All"}
                </button>
              ))}
            </div>
          </div>

          {/* Breakdown & View Log Link */}
          <div className="flex items-center justify-between text-xs mt-2 pt-1 border-t border-violet-100 dark:border-violet-900/20">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                📱 {historyData?.summary?.whatsapp ?? 0}
              </span>
              <span>•</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                🔔 {historyData?.summary?.in_app ?? 0}
              </span>
            </span>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-[11px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              {t("Log", "Log")} →
            </button>
          </div>
        </Card>
      </div>

      {/* AI Recommendation Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-indigo-950 dark:text-indigo-200">
              {t("Automated Low-Stock Replenishment Engine", "Automated Low-Stock Replenishment Engine")}
            </h3>
            <p className="text-sm text-indigo-800/80 dark:text-indigo-300/80 mt-1">
              Whenever cashiers ring up sales or inventory items transfer between warehouses, our real-time trigger analyzes stock balances against each item's reorder point. If breached, instant In-App system notifications and WhatsApp alerts are dispatched to your procurement manager.
            </p>
          </div>
        </div>
      </div>

      {/* Search, Filter Pills & View Mode Switcher Toolbar */}
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

        {/* Center: Status Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border w-full lg:w-auto overflow-x-auto">
          <Button
            size="sm"
            variant={activeFilter === "all" ? "default" : "ghost"}
            onClick={() => setActiveFilter("all")}
            className="text-xs h-8 cursor-pointer"
          >
            {t("All Alerts", "All Alerts")} ({combinedList.length})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === "stockout" ? "default" : "ghost"}
            onClick={() => setActiveFilter("stockout")}
            className={`text-xs h-8 cursor-pointer ${activeFilter === "stockout" ? "bg-rose-600 text-white hover:bg-rose-700" : "text-rose-600"}`}
          >
            {t("Out of Stock", "Out of Stock")} ({stockouts.length})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === "low_stock" ? "default" : "ghost"}
            onClick={() => setActiveFilter("low_stock")}
            className={`text-xs h-8 cursor-pointer ${activeFilter === "low_stock" ? "bg-amber-600 text-white hover:bg-amber-700" : "text-amber-600"}`}
          >
            {t("Low Stock", "Low Stock")} ({lowStock.length})
          </Button>
        </div>

        {/* Right: Export & View Layout Switcher (Cards vs Table) */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer"
            title="Export filtered items to CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">{t("Export CSV", "Export CSV")}</span>
          </Button>

          {/* Cards / Table Toggle */}
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

      {/* Floating Bulk Action Bar when rows selected */}
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
              onClick={async () => {
                const selectedItems = filteredItems.filter((i) => selectedItemIds.has(String(i.id)));
                if (!config.manager_whatsapp) {
                  toast.error(t("Set WhatsApp number in Settings first.", "Set WhatsApp number in Settings first."));
                  return;
                }
                const lines = selectedItems.map(
                  (it, idx) => `${idx + 1}. *${it.name}* (SKU: ${it.sku}): Stock ${it.stock} ${it.unit || "pcs"} (Reorder: ${it.reorder_level})`
                ).join("\n");
                try {
                  await inventoryAlertsApi.testWhatsApp({
                    phone_number: config.manager_whatsapp,
                    custom_message: `🚨 *Urgent Bulk Reorder Digest (${selectedItems.length} items):*\n\n${lines}\n\nPlease issue purchase orders immediately.`,
                  });
                  toast.success(t("Dispatched WhatsApp alert for selected products!", "Dispatched WhatsApp alert for selected products!"));
                  loadHistory();
                } catch (err: any) {
                  toast.error(err?.message || "Failed to dispatch WhatsApp digest");
                }
              }}
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

      {/* Main Content Area: Loading / Empty / Table / Cards */}
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
            {t("Healthy Stock Levels", "Healthy Stock Levels")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {searchQuery
              ? t("No low stock products match your search query.", "No low stock products match your search query.")
              : t("All inventory products are safely above their reorder thresholds.", "All inventory products are safely above their reorder thresholds.")}
          </p>
        </Card>
      ) : viewMode === "table" ? (
        /* ═════════════════════════════════════════════════════════════════════ */
        /* PROFESSIONAL SPREADSHEET TABLE VIEW                                   */
        /* ═════════════════════════════════════════════════════════════════════ */
        <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-sm flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/50 dark:bg-muted/20 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  {/* Selection Checkbox */}
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.size === filteredItems.length && filteredItems.length > 0}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Select all / Deselect all"
                    />
                  </th>

                  {/* Product & SKU */}
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

                  {/* Category */}
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

                  {/* Status Badge */}
                  <th className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase"
                    >
                      <span>{t("Status", "Status")}</span>
                      {sortField === "status" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  {/* Current Stock */}
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("stock")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Current Stock", "Current Stock")}</span>
                      {sortField === "stock" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  {/* Min Reorder Level */}
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("reorder_level")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Min Reorder", "Min Reorder")}</span>
                      {sortField === "reorder_level" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  {/* Deficit / Units Needed */}
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("deficit")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Units Needed", "Units Needed")}</span>
                      {sortField === "deficit" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  {/* Health Bar */}
                  <th className="py-3 px-4 w-32">{t("Threshold Health", "Threshold Health")}</th>

                  {/* Actions */}
                  <th className="py-3 px-4 text-right w-44">{t("Quick Actions", "Quick Actions")}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const isStockout = item.isStockout;
                  const isSelected = selectedItemIds.has(String(item.id));
                  const stockPct = item.reorder_level > 0 ? Math.min(100, Math.round((Math.max(0, item.stock) / item.reorder_level) * 100)) : 0;
                  const deficit = Math.max(0, (item.reorder_level || 0) - (item.stock || 0));

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
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleItem(String(item.id))}
                          className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Product & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "size-9 rounded-xl flex items-center justify-center shrink-0 border",
                              isStockout
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            )}
                          >
                            {isStockout ? <PackageX className="size-4" /> : <PackageOpen className="size-4" />}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-foreground block truncate max-w-[360px] lg:max-w-[550px] xl:max-w-[700px]">
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

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-muted/80 px-2.5 py-1 rounded-md border border-border/60">
                          {item.category || "General"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black border",
                            isStockout
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 shadow-2xs"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-2xs"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              isStockout ? "bg-rose-600 animate-pulse" : "bg-amber-600"
                            )}
                          />
                          {isStockout ? t("OUT OF STOCK", "OUT OF STOCK") : t("LOW STOCK", "LOW STOCK")}
                        </span>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={cn(
                            "font-black text-sm",
                            isStockout
                              ? "text-rose-600 dark:text-rose-400 font-mono"
                              : "text-amber-600 dark:text-amber-400 font-mono"
                          )}
                        >
                          {item.stock}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {item.unit || "pcs"}
                          </span>
                        </span>
                      </td>

                      {/* Min Reorder */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-sm text-foreground font-mono">
                          {item.reorder_level}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {item.unit || "pcs"}
                          </span>
                        </span>
                      </td>

                      {/* Units Needed (Deficit) */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center font-black text-xs px-2.5 py-1 rounded-md border",
                            deficit > 0
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          +{deficit} {item.unit || "pcs"}
                        </span>
                      </td>

                      {/* Health Progress */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                            <span>{stockPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isStockout ? "bg-rose-500 w-0" : "bg-amber-500"
                              )}
                              style={{ width: `${stockPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/procurement?action=create_po&product_id=${item.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                            title="Create Purchase Order for this item"
                          >
                            <ShoppingCart className="size-3" />
                            <span>{t("Create PO", "Create PO")}</span>
                          </a>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDispatchWhatsAppForProduct(item)}
                            className="size-7 p-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            title="Send WhatsApp Alert to Manager"
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

          {/* Table Footer info strip */}
          <div className="px-4 py-3 bg-muted/30 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
            <span>
              {t("Showing", "Showing")}{" "}
              <strong className="text-foreground">{filteredItems.length}</strong>{" "}
              {t("critical inventory items requiring restock", "critical inventory items requiring restock")}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                <span>{stockouts.length} {t("Out of Stock", "Out of Stock")}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                <span>{lowStock.length} {t("Low Stock", "Low Stock")}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ═════════════════════════════════════════════════════════════════════ */
        /* CARDS / TILES GRID VIEW                                               */
        /* ═════════════════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const isStockout = item.isStockout;
            const stockPct = item.reorder_level > 0 ? Math.min(100, Math.round((Math.max(0, item.stock) / item.reorder_level) * 100)) : 0;
            const deficit = Math.max(0, (item.reorder_level || 0) - (item.stock || 0));

            return (
              <Card
                key={item.id}
                className={`p-5 transition-all hover:shadow-lg border-t-4 ${
                  isStockout ? "border-t-rose-500 bg-rose-500/[0.02]" : "border-t-amber-500 bg-amber-500/[0.02]"
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      isStockout
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    <AlertTriangle className="size-3.5" />
                    {isStockout ? t("OUT OF STOCK", "OUT OF STOCK") : t("LOW STOCK", "LOW STOCK")}
                  </span>

                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                    {item.category || "General"}
                  </span>
                </div>

                <h3 className="font-bold text-lg text-foreground leading-snug line-clamp-1 mb-0.5">
                  {item.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-4">
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

                {/* Stock metrics */}
                <div className="bg-muted/40 dark:bg-muted/20 p-3.5 rounded-xl border border-dashed grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                      {t("Current Stock", "Current Stock")}
                    </div>
                    <div className={`text-xl font-black ${isStockout ? "text-rose-600" : "text-amber-600"}`}>
                      {item.stock} <span className="text-xs font-normal text-muted-foreground">{item.unit || "pcs"}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                      {t("Min Reorder Point", "Min Reorder Point")}
                    </div>
                    <div className="text-xl font-black text-foreground">
                      {item.reorder_level} <span className="text-xs font-normal text-muted-foreground">{item.unit || "pcs"}</span>
                    </div>
                  </div>
                </div>

                {/* Shortage indicator */}
                <div className="flex items-center justify-between text-xs mb-3 font-semibold">
                  <span className="text-muted-foreground">{t("Replenishment Required:", "Replenishment Required:")}</span>
                  <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
                    +{deficit} {item.unit || "pcs"}
                  </span>
                </div>

                {/* Stock Level Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{t("Threshold Health", "Threshold Health")}</span>
                    <span className="font-bold">{stockPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        isStockout ? "bg-rose-500 w-0" : "bg-amber-500"
                      }`}
                      style={{ width: `${stockPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <a
                    href={`/procurement?action=create_po&product_id=${item.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <ShoppingCart className="size-3.5" />
                    {t("Create PO", "Create PO")}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDispatchWhatsAppForProduct(item)}
                    className="text-xs h-9 px-3 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                    title="Send WhatsApp Alert to Manager"
                  >
                    <MessageSquare className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Configuration & WhatsApp Settings Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="size-5 text-indigo-400" />
                  <h3 className="text-lg font-bold">
                    {t("Inventory Alerts & WhatsApp Setup", "Inventory Alerts & WhatsApp Setup")}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {t("Configure real-time mobile notifications and WhatsApp dispatch for store managers.", "Configure real-time mobile notifications and WhatsApp dispatch for store managers.")}
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* WhatsApp Phone Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {t("Manager WhatsApp Phone Number", "Manager WhatsApp Phone Number")}
                  </label>
                  <div className="relative">
                    <Smartphone className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={config.manager_whatsapp || ""}
                      onChange={(e) => setConfig({ ...config, manager_whatsapp: e.target.value })}
                      placeholder="e.g. 919876543210 (Country code + 10 digits)"
                      className="pl-9 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t("Must include country code without plus sign (e.g., 919876543210 for India).", "Must include country code without plus sign (e.g., 919876543210 for India).")}
                  </p>
                </div>

                {/* Gateway Status Badge */}
                <div className="p-3 rounded-xl bg-muted/40 border flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">
                    {t("WhatsApp Gateway Status:", "WhatsApp Gateway Status:")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${waConnected ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className={`font-bold ${waConnected ? "text-emerald-600" : "text-rose-600"}`}>
                      {waConnected ? t("Connected (Live)", "Connected (Live)") : t("Disconnected / Session Expired", "Disconnected / Session Expired")}
                    </span>
                  </div>
                </div>

                {/* Channel Toggles */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {t("Notification Triggers", "Notification Triggers")}
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/20 cursor-pointer">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground">
                        {t("WhatsApp Low Stock & Stockout Alerts", "WhatsApp Low Stock & Stockout Alerts")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t("Dispatches instant WhatsApp alerts when any SKU hits 0 or reorder level", "Dispatches instant WhatsApp alerts when any SKU hits 0 or reorder level")}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.low_stock_whatsapp}
                      onChange={(e) => setConfig({ ...config, low_stock_whatsapp: e.target.checked })}
                      className="size-4 rounded text-indigo-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/20 cursor-pointer">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground">
                        {t("In-App Push System Alerts", "In-App Push System Alerts")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t("Sends browser and bell push notifications to store operators", "Sends browser and bell push notifications to store operators")}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.low_stock_push}
                      onChange={(e) => setConfig({ ...config, low_stock_push: e.target.checked })}
                      className="size-4 rounded text-indigo-600"
                    />
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestWhatsApp}
                  disabled={testingWa}
                  className="text-xs font-semibold cursor-pointer"
                >
                  <PhoneCall className={`size-3.5 mr-1.5 ${testingWa ? "animate-spin" : ""}`} />
                  {t("Send Test WhatsApp", "Send Test WhatsApp")}
                </Button>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowConfigModal(false)} className="cursor-pointer">
                    {t("Cancel", "Cancel")}
                  </Button>
                  <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig} className="bg-indigo-600 hover:bg-indigo-700 cursor-pointer">
                    {savingConfig ? t("Saving...", "Saving...") : t("Save Settings", "Save Settings")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Log Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                    <History className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      {t("Alerts Dispatch Audit Trail", "Alerts Dispatch Audit Trail")}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {t("Complete chronological log of In-App and WhatsApp alerts sent to managers", "Complete chronological log of In-App and WhatsApp alerts sent to managers")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Filters in Log Modal */}
              <div className="p-4 bg-muted/40 border-b flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground mr-1">
                    {t("Period:", "Period:")}
                  </span>
                  {(["today", "7d", "30d", "all"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setHistoryPeriod(p)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        historyPeriod === p
                          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                          : "bg-background border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {p === "today" ? t("Today", "Today") : p === "7d" ? t("Last 7 Days", "Last 7 Days") : p === "30d" ? t("Last 30 Days", "Last 30 Days") : t("All Time", "All Time")}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground mr-1">
                    {t("Channel:", "Channel:")}
                  </span>
                  {(["all", "whatsapp", "in_app"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setHistoryChannel(ch)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                        historyChannel === ch
                          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                          : "bg-background border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {ch === "all" ? t("All", "All") : ch === "whatsapp" ? t("📱 WhatsApp", "📱 WhatsApp") : t("🔔 In-App", "🔔 In-App")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Stats Strip inside Modal */}
              <div className="px-6 py-3 bg-muted/20 border-b flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {t("Total Logged Alerts:", "Total Logged Alerts:")}{" "}
                  <strong className="text-foreground">{historyData?.summary?.total ?? 0}</strong>
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    📱 WhatsApp: {historyData?.summary?.whatsapp ?? 0}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                    🔔 In-App Push: {historyData?.summary?.in_app ?? 0}
                  </span>
                </div>
              </div>

              {/* Alert Items List */}
              <div className="p-6 overflow-y-auto flex-1 space-y-3">
                {historyLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <RefreshCw className="size-6 animate-spin mb-2" />
                    <p className="text-sm">{t("Loading dispatch logs...", "Loading dispatch logs...")}</p>
                  </div>
                ) : historyData?.alerts?.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-dashed rounded-2xl bg-muted/20">
                    <div className="size-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                      <Bell className="size-6" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">
                      {t("No Alerts Dispatched in this Period", "No Alerts Dispatched in this Period")}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                      {t(
                        "When products breach low-stock thresholds or automated digests run, all dispatched alerts are logged here.",
                        "When products breach low-stock thresholds or automated digests run, all dispatched alerts are logged here."
                      )}
                    </p>
                  </div>
                ) : (
                  historyData.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors flex items-start gap-3"
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          alert.channel === "whatsapp"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                        }`}
                      >
                        {alert.channel === "whatsapp" ? (
                          <MessageSquare className="size-4" />
                        ) : (
                          <Bell className="size-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-foreground truncate">
                            {alert.title}
                          </h5>
                          <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                            <Clock className="size-3" />
                            {alert.created_at ? new Date(alert.created_at).toLocaleString() : ""}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {alert.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-muted/30 border-t flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowHistoryModal(false)} className="cursor-pointer">
                  {t("Close", "Close")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
