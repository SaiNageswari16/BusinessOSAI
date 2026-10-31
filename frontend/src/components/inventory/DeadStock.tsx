import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { useCurrency } from "@/hooks/use-currency";
import { inventoryAlertsApi } from "@/lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Skull,
  DollarSign,
  Archive,
  Clock,
  Layers,
  Sparkles,
  Search,
  RefreshCw,
  Sliders,
  Send,
  MessageSquare,
  Tag,
  ArrowRight,
  PackageX,
  Maximize2,
  Minimize2,
  Download,
  LayoutGrid,
  Rows3,
  Copy,
  Check,
  CheckCircle2,
  PhoneCall,
  Smartphone,
  History,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DeadStockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  cost_price: number;
  locked_capital: number;
  category: string;
  unit?: string;
}

export function DeadStock() {
  const { t } = useI18n();
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    dead_stock_push: true,
    dead_stock_whatsapp: true,
    dead_stock_days: 90,
    manager_whatsapp: "",
  });
  const [waConnected, setWaConnected] = useState(false);
  const [inactivityDays, setInactivityDays] = useState<number>(90);
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

  // View Mode: Cards vs Table (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    try {
      return (localStorage.getItem("dead_stock_view_mode") as "cards" | "table") || "table";
    } catch {
      return "table";
    }
  });

  const handleSetViewMode = (mode: "cards" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("dead_stock_view_mode", mode);
    } catch {}
  };

  // Table Sorting
  type SortField = "name" | "stock" | "cost_price" | "locked_capital" | "category";
  const [sortField, setSortField] = useState<SortField>("locked_capital");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selected Items for Bulk Clearance / Liquidation
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  // Modals & Async States
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

  const loadDeadStock = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        inventoryAlertsApi.getStatus(inactivityDays),
        inventoryAlertsApi.getConfig(),
      ]);

      setData(statusRes);

      if (configRes && configRes.config) {
        setConfig(configRes.config);
        setWaConnected(Boolean(configRes.whatsapp_connected));
      }
    } catch (err: any) {
      console.error("Failed to load dead stock data:", err);
      toast.error(t("Failed to analyze dead stock", "Failed to analyze dead stock"));
    } finally {
      setLoading(false);
    }
  }, [inactivityDays, t]);

  useEffect(() => {
    loadDeadStock();
    loadHistory();
  }, [loadDeadStock, loadHistory]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await inventoryAlertsApi.updateConfig({
        ...config,
        dead_stock_days: inactivityDays,
      });
      toast.success(t("Dead stock alert settings updated successfully!", "Dead stock alert settings updated successfully!"));
      setShowConfigModal(false);
      loadDeadStock();
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
        custom_message: `☠️ *Dead Stock Alert System Test:*\n\nYour WhatsApp liquidation alert notifications are connected and working properly.`,
      });
      if (res.success) {
        toast.success(t("Test WhatsApp message dispatched successfully!", "Test WhatsApp message dispatched successfully!"));
        loadHistory();
      } else {
        toast.warning(t("Message queued, but gateway reported: ", "Message queued, but gateway reported: ") + (res.error || "Offline"));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch test WhatsApp");
    } finally {
      setTestingWa(false);
    }
  };

  const handleSendDeadStockAlert = async () => {
    setSendingDigest(true);
    try {
      const phone = config?.manager_whatsapp;
      if (!phone) {
        toast.error(t("Please set a Manager WhatsApp number in Settings first.", "Please set a Manager WhatsApp number in Settings first."));
        setShowConfigModal(true);
        return;
      }
      const res = await inventoryAlertsApi.triggerDigest(phone);
      if (res.whatsapp_delivery?.success) {
        toast.success(t("Dead Stock liquidation summary dispatched to WhatsApp!", "Dead Stock liquidation summary dispatched to WhatsApp!"));
      } else {
        toast.success(t("In-App alert digest posted! (WhatsApp gateway offline or unauthenticated)", "In-App alert digest posted! (WhatsApp gateway offline or unauthenticated)"));
      }
      loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch liquidation alert");
    } finally {
      setSendingDigest(false);
    }
  };

  const handleDispatchWhatsAppForProduct = async (item: DeadStockItem) => {
    if (!config.manager_whatsapp) {
      toast.error(t("Please configure a Manager WhatsApp number in Settings first.", "Please configure a Manager WhatsApp number in Settings first."));
      setShowConfigModal(true);
      return;
    }

    try {
      await inventoryAlertsApi.testWhatsApp({
        phone_number: config.manager_whatsapp,
        custom_message: `☠️ *Dead Stock Liquidation Alert:*\n\n• Product: *${item.name}*\n• SKU: \`${item.sku || "N/A"}\`\n• Stagnant Quantity: *${item.stock} ${item.unit || "units"}*\n• Cost Price: ₹${(item.cost_price || 0).toLocaleString()}\n• Locked Capital: *₹${(item.locked_capital || 0).toLocaleString()}*\n• Inactivity Period: ${inactivityDays} Days with 0 sales movements\n\nRecommended: Apply clearance discount or initiate supplier RTV credit.`,
      });
      toast.success(t("WhatsApp liquidation alert dispatched for this product!", "WhatsApp liquidation alert dispatched for this product!"));
      loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp alert");
    }
  };

  const handleSendSelectedWhatsApp = async () => {
    const selectedItems = filteredItems.filter((i) => selectedItemIds.has(String(i.id)));
    if (selectedItems.length === 0) return;

    if (!config.manager_whatsapp) {
      toast.error(t("Please set a WhatsApp number in Settings first.", "Please set a WhatsApp number in Settings first."));
      setShowConfigModal(true);
      return;
    }

    const lines = selectedItems
      .slice(0, 10)
      .map(
        (it, idx) =>
          `${idx + 1}. *${it.name}* (SKU: ${it.sku}): ${it.stock} ${it.unit || "units"} (Locked: ₹${Math.round(it.locked_capital || 0).toLocaleString()})`
      )
      .join("\n");

    const totalSelectedVal = selectedItems.reduce((acc, curr) => acc + (curr.locked_capital || 0), 0);

    try {
      await inventoryAlertsApi.testWhatsApp({
        phone_number: config.manager_whatsapp,
        custom_message: `☠️ *Bulk Dead Stock Liquidation Digest (${selectedItems.length} items):*\n\n${lines}${selectedItems.length > 10 ? `\n...and ${selectedItems.length - 10} more items` : ""}\n\n*Total Locked Capital:* ₹${Math.round(totalSelectedVal).toLocaleString()}\n*Inactivity Window:* ${inactivityDays} Days\n\nPlease approve promotional discounts or vendor return requests.`,
      });
      toast.success(t("Dispatched WhatsApp alert for selected dead stock products!", "Dispatched WhatsApp alert for selected dead stock products!"));
      loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp digest");
    }
  };

  const deadItems: DeadStockItem[] = data?.dead_stock_items || [];
  const categories = Array.from(new Set(deadItems.map((i: any) => i.category || "General")));

  const totalLockedCapital = data?.summary?.dead_capital_amount || 0;
  const deadCount = data?.summary?.dead_stock_count || 0;

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = deadItems.filter((item: DeadStockItem) => {
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
  }, [deadItems, searchQuery, categoryFilter, sortField, sortDirection]);

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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
      "Stagnant Qty",
      "Unit",
      "Cost Price",
      "Locked Capital",
      "Inactivity Days",
      "Recommended Action",
    ];
    const rows = filteredItems.map((item) => [
      `"${(item.name || "").replace(/"/g, '""')}"`,
      `"${item.sku || ""}"`,
      `"${item.category || "General"}"`,
      item.stock,
      `"${item.unit || "units"}"`,
      item.cost_price || 0,
      item.locked_capital || 0,
      inactivityDays,
      '"Clearance Discount / Vendor RTV"',
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Dead_Stock_Liquidation_${inactivityDays}d_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("Exported dead stock report to CSV", "Exported dead stock report to CSV"));
  };

  return (
    <div
      className={cn(
        "space-y-5 w-full pb-12 px-1 sm:px-2 transition-all",
        isFullscreen && "p-4 sm:p-6 bg-background min-h-screen overflow-y-auto"
      )}
    >
      {/* Header (clean, standard design matching Low Stock Alert Center) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-rose-500/10 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400">
              <Skull className="size-5 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("Dead Stock Intelligence & Liquidation", "Dead Stock Intelligence & Liquidation")}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              Live Monitoring
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              "Identify stagnant products tying up capital with zero sales movements in 30 to 180+ days.",
              "Identify stagnant products tying up capital with zero sales movements in 30 to 180+ days."
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
            onClick={loadDeadStock}
            disabled={loading}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{t("Refresh", "Refresh")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            className="h-8 text-xs font-semibold border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="size-3.5" />
            <span>{t("Alert Settings & WhatsApp", "Alert Settings & WhatsApp")}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSendDeadStockAlert}
            disabled={sendingDigest}
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Send className={`size-3.5 ${sendingDigest ? "animate-spin" : ""}`} />
            <span>{t("Broadcast Liquidation Alert", "Broadcast Liquidation Alert")}</span>
          </Button>
        </div>
      </div>

      {/* Compact KPI Stats (5 cards in matching layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Total Locked Capital */}
        <div className="p-3 bg-card border border-rose-200/80 dark:border-rose-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider truncate">
              {t("Total Locked Capital", "Total Locked Capital")}
            </span>
            <div className="size-6 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
              <DollarSign className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono">
              {formatCurrency(totalLockedCapital)}
            </span>
            <span className="text-[10px] font-semibold text-rose-600/80 truncate">
              Non-performing capital
            </span>
          </div>
        </div>

        {/* Stagnant Products */}
        <div className="p-3 bg-card border border-amber-200/80 dark:border-amber-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate">
              {t("Stagnant Products", "Stagnant Products")}
            </span>
            <div className="size-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
              <Archive className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {deadCount}
            </span>
            <span className="text-[10px] font-semibold text-amber-600/80 truncate">
              Zero sales movements
            </span>
          </div>
        </div>

        {/* Inactivity Threshold */}
        <div className="p-3 bg-card border border-purple-200/80 dark:border-purple-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider truncate">
              {t("Inactivity Threshold", "Inactivity Threshold")}
            </span>
            <div className="size-6 rounded-lg bg-purple-500/15 text-purple-600 flex items-center justify-center shrink-0">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-purple-700 dark:text-purple-400 font-mono">
              {inactivityDays} <span className="text-xs font-normal text-muted-foreground">{t("Days", "Days")}</span>
            </span>
            <span className="text-[10px] font-semibold text-purple-600/80 truncate">
              Evaluation window
            </span>
          </div>
        </div>

        {/* Expiring Batches (<30D) */}
        <div className="p-3 bg-card border border-sky-200/80 dark:border-sky-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider truncate">
              {t("Expiring Batches (<30d)", "Expiring Batches (<30d)")}
            </span>
            <div className="size-6 rounded-lg bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
              <Layers className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-sky-700 dark:text-sky-400 font-mono">
              {data?.summary?.expiring_batches_count ?? 0}
            </span>
            <span className="text-[10px] font-semibold text-sky-600/80 truncate">
              Requires clearance promo
            </span>
          </div>
        </div>

        {/* WhatsApp Alert Dispatch / Alerts Log Card */}
        <div className="p-3 bg-card border border-emerald-200/80 dark:border-emerald-900/40 rounded-xl shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">
              {t("WhatsApp Alert Dispatch", "WhatsApp Alert Dispatch")}
            </span>
            <div className="size-6 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <MessageSquare className="size-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full shrink-0 ${
                config.dead_stock_whatsapp && config.manager_whatsapp ? "bg-emerald-500 animate-ping" : "bg-slate-400"
              }`}
            />
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
              {config.dead_stock_whatsapp && config.manager_whatsapp ? "Active" : "Unconfigured"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-emerald-100 dark:border-emerald-900/20">
            <span className="text-muted-foreground truncate">
              📱 {historyData?.summary?.whatsapp ?? 0} • 🔔 {historyData?.summary?.in_app ?? 0}
            </span>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-[10px] font-bold text-emerald-600 hover:underline shrink-0 cursor-pointer"
            >
              Log →
            </button>
          </div>
        </div>
      </div>

      {/* AI Capital Liquidation Recommendations Banner */}
      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
              {t("AI Capital Liquidation Recommendations", "AI Capital Liquidation Recommendations")}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
              {t(
                "Bundle top dead stock items with high-velocity bestsellers at 15–20% discount or initiate supplier RTV (Return to Vendor) credits to unlock",
                "Bundle top dead stock items with high-velocity bestsellers at 15–20% discount or initiate supplier RTV (Return to Vendor) credits to unlock"
              )}{" "}
              <strong className="text-rose-600 dark:text-rose-400 font-black">{formatCurrency(totalLockedCapital)}</strong>{" "}
              {t("in frozen cash flow.", "in frozen cash flow.")}
            </p>
          </div>
        </div>
      </div>

      {/* Search, Inactivity Period Selector, Category & View Switcher Toolbar */}
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

        {/* Center: Inactivity Period Selector Pills & Category Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
            <span className="text-[10px] font-bold text-muted-foreground px-2 uppercase tracking-wider">
              {t("Period:", "Period:")}
            </span>
            {[30, 60, 90, 180].map((days) => (
              <Button
                key={days}
                size="sm"
                variant={inactivityDays === days ? "default" : "ghost"}
                onClick={() => setInactivityDays(days)}
                className={cn(
                  "text-xs h-7 px-2.5 rounded-lg font-bold cursor-pointer transition-all",
                  inactivityDays === days
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {days} {t("Days", "Days")}
              </Button>
            ))}
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

        {/* Right: Export CSV & View Mode (Cards / Table) */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs font-semibold border-border hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer"
            title="Export dead stock items to CSV"
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
            <span className="size-2 rounded-full bg-rose-400 animate-ping" />
            <span>
              {selectedItemIds.size} {t("stagnant product(s) selected for liquidation", "stagnant product(s) selected for liquidation")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                toast.success(
                  t(
                    `Clearance discount applied for ${selectedItemIds.size} selected products!`,
                    `Clearance discount applied for ${selectedItemIds.size} selected products!`
                  )
                );
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Tag className="size-3.5" />
              {t("Clearance Discount", "Clearance Discount")}
            </button>

            <a
              href={`/inventory?tab=stock_movement&product_ids=${Array.from(selectedItemIds).join(",")}`}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <ArrowRight className="size-3.5" />
              {t("Bulk Transfer / RTV", "Bulk Transfer / RTV")}
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
            {t("Zero Dead Stock Detected", "Zero Dead Stock Detected")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {searchQuery
              ? t("No stagnant products match your search query.", "No stagnant products match your search query.")
              : t(
                  `All products have active stock movements within the selected ${inactivityDays}-day window. Inventory turnover is optimal!`,
                  `All products have active stock movements within the selected ${inactivityDays}-day window. Inventory turnover is optimal!`
                )}
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

                  {/* Stagnant Qty */}
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("stock")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Stagnant Qty", "Stagnant Qty")}</span>
                      {sortField === "stock" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  {/* Cost Price */}
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("cost_price")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Cost Price", "Cost Price")}</span>
                      {sortField === "cost_price" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  {/* Locked Capital */}
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort("locked_capital")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground cursor-pointer font-bold uppercase ml-auto"
                    >
                      <span>{t("Locked Capital", "Locked Capital")}</span>
                      {sortField === "locked_capital" ? (
                        sortDirection === "asc" ? <ArrowUp className="size-3 text-indigo-600" /> : <ArrowDown className="size-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  {/* Capital Impact Share */}
                  <th className="py-3 px-4 w-32">{t("Capital Share", "Capital Share")}</th>

                  {/* Quick Actions */}
                  <th className="py-3 px-4 text-right w-56">{t("Recommended Action", "Recommended Action")}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => {
                  const isSelected = selectedItemIds.has(String(item.id));
                  const capitalSharePct =
                    totalLockedCapital > 0
                      ? Math.min(100, Math.round(((item.locked_capital || 0) / totalLockedCapital) * 100))
                      : 0;

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "transition-colors group",
                        isSelected
                          ? "bg-rose-50/50 dark:bg-rose-950/20"
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
                          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 border bg-rose-500/10 text-rose-600 border-rose-500/20">
                            <Skull className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-foreground block truncate max-w-[320px] lg:max-w-[480px]">
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

                      {/* Stagnant Qty */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-sm text-rose-600 dark:text-rose-400 font-mono">
                          {item.stock}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {item.unit || "units"}
                          </span>
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-semibold text-xs text-muted-foreground font-mono">
                          {formatCurrency(item.cost_price || 0)}
                        </span>
                      </td>

                      {/* Locked Capital */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-sm text-rose-700 dark:text-rose-300 font-mono">
                          {formatCurrency(item.locked_capital || 0)}
                        </span>
                      </td>

                      {/* Capital Impact Share Bar */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                            <span>{capitalSharePct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-rose-500 transition-all"
                              style={{ width: `${Math.max(4, capitalSharePct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              toast.info(t(`Clearance discount applied for ${item.name}`, `Clearance discount applied for ${item.name}`));
                            }}
                            className="text-xs h-7 px-2.5 text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Tag className="size-3 mr-1" />
                            <span>{t("Clearance Discount", "Clearance Discount")}</span>
                          </Button>

                          <a
                            href={`/inventory?tab=stock_movement&product_id=${item.id}`}
                            className="inline-flex items-center text-xs h-7 px-2.5 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <ArrowRight className="size-3 mr-1" />
                            <span>{t("Transfer / RTV", "Transfer / RTV")}</span>
                          </a>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDispatchWhatsAppForProduct(item)}
                            className="size-7 p-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                            title="Send WhatsApp Liquidation Alert"
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
              {t("stagnant products tying up", "stagnant products tying up")}{" "}
              <strong className="text-rose-600 font-bold">{formatCurrency(totalLockedCapital)}</strong>{" "}
              {t("in working capital", "in working capital")}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                <span>{deadCount} {t("Stagnant Products", "Stagnant Products")}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-purple-500" />
                <span>{inactivityDays} {t("Days Threshold", "Days Threshold")}</span>
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
            const capitalSharePct =
              totalLockedCapital > 0
                ? Math.min(100, Math.round(((item.locked_capital || 0) / totalLockedCapital) * 100))
                : 0;

            return (
              <Card
                key={item.id}
                className="p-5 transition-all hover:shadow-lg border-t-4 border-t-rose-500 bg-rose-500/[0.02]"
              >
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                    {item.category || "General"}
                  </span>
                  <span className="text-xs font-bold text-rose-600 font-mono">
                    {capitalSharePct}% {t("of locked capital", "of locked capital")}
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

                {/* Stock & Capital metrics */}
                <div className="bg-muted/40 dark:bg-muted/20 p-3.5 rounded-xl border border-dashed grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                      {t("Stagnant Stock", "Stagnant Stock")}
                    </div>
                    <div className="text-xl font-black text-rose-600">
                      {item.stock} <span className="text-xs font-normal text-muted-foreground">{item.unit || "units"}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground font-semibold uppercase">
                      {t("Locked Capital", "Locked Capital")}
                    </div>
                    <div className="text-xl font-black text-foreground">
                      {formatCurrency(item.locked_capital || 0)}
                    </div>
                  </div>
                </div>

                {/* Capital share progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{t("Capital Impact Share", "Capital Impact Share")}</span>
                    <span className="font-bold">{capitalSharePct}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all"
                      style={{ width: `${Math.max(4, capitalSharePct)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toast.info(t(`Clearance discount applied for ${item.name}`, `Clearance discount applied for ${item.name}`));
                    }}
                    className="flex-1 text-xs h-9 px-2.5 text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 cursor-pointer"
                  >
                    <Tag className="size-3.5 mr-1" />
                    <span>{t("Clearance Discount", "Clearance Discount")}</span>
                  </Button>

                  <a
                    href={`/inventory?tab=stock_movement&product_id=${item.id}`}
                    className="inline-flex items-center justify-center text-xs h-9 px-3 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ArrowRight className="size-3.5" />
                  </a>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDispatchWhatsAppForProduct(item)}
                    className="size-9 p-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                    title="Send WhatsApp Liquidation Alert"
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
                    {t("Dead Stock & Liquidation Alert Setup", "Dead Stock & Liquidation Alert Setup")}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {t(
                    "Configure real-time mobile notifications and WhatsApp dispatch for store managers.",
                    "Configure real-time mobile notifications and WhatsApp dispatch for store managers."
                  )}
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

                {/* Inactivity Threshold selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {t("Default Inactivity Window (Days)", "Default Inactivity Window (Days)")}
                  </label>
                  <div className="flex gap-2">
                    {[30, 60, 90, 180].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant={inactivityDays === d ? "default" : "outline"}
                        onClick={() => setInactivityDays(d)}
                        className="flex-1 text-xs"
                      >
                        {d} {t("Days", "Days")}
                      </Button>
                    ))}
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
                        {t("WhatsApp Dead Stock Liquidation Alerts", "WhatsApp Dead Stock Liquidation Alerts")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t("Dispatches WhatsApp digests of stagnant SKUs tying up cash flow", "Dispatches WhatsApp digests of stagnant SKUs tying up cash flow")}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.dead_stock_whatsapp}
                      onChange={(e) => setConfig({ ...config, dead_stock_whatsapp: e.target.checked })}
                      className="size-4 rounded text-indigo-600 cursor-pointer"
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
                      checked={config.dead_stock_push}
                      onChange={(e) => setConfig({ ...config, dead_stock_push: e.target.checked })}
                      className="size-4 rounded text-indigo-600 cursor-pointer"
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
                      {t("Liquidation Alerts Dispatch Audit Trail", "Liquidation Alerts Dispatch Audit Trail")}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {t("Complete chronological log of In-App and WhatsApp alerts sent to managers", "Complete chronological log of In-App and WhatsApp alerts sent to managers")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Filter controls */}
              <div className="p-4 bg-muted/40 border-b flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-muted-foreground mr-1">Period:</span>
                  {(["today", "7d", "30d", "all"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setHistoryPeriod(p);
                        loadHistory(p, historyChannel);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer",
                        historyPeriod === p
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p === "today" ? "Today" : p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "All"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-muted-foreground mr-1">Channel:</span>
                  {(["all", "whatsapp", "in_app"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => {
                        setHistoryChannel(ch);
                        loadHistory(historyPeriod, ch);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer",
                        historyChannel === ch
                          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {ch === "all" ? "All" : ch === "whatsapp" ? "WhatsApp" : "In-App"}
                    </button>
                  ))}
                </div>
              </div>

              {/* History Items list */}
              <div className="p-6 overflow-y-auto flex-1 space-y-3">
                {historyLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="size-4 animate-spin text-indigo-600" />
                    <span>Loading dispatch logs...</span>
                  </div>
                ) : historyData.alerts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <History className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold">No liquidation alerts dispatched in this period.</p>
                  </div>
                ) : (
                  historyData.alerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors flex items-start gap-3"
                    >
                      <div
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                          al.channel === "whatsapp"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                        )}
                      >
                        {al.channel === "whatsapp" ? (
                          <MessageSquare className="size-4" />
                        ) : (
                          <Radio className="size-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-foreground truncate">{al.title}</h4>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {new Date(al.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">
                          {al.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal footer summary */}
              <div className="p-4 bg-muted/30 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Total logged: <strong className="text-foreground">{historyData.summary.total}</strong> alerts
                </span>
                <Button size="sm" variant="ghost" onClick={() => setShowHistoryModal(false)} className="cursor-pointer">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
