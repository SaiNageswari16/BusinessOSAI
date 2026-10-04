import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
  const [activeFilter, setActiveFilter] = useState<"all" | "stockout" | "low_stock">("all");

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingWa, setTestingWa] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

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
    } catch (err: any) {
      console.error("Failed to load inventory alerts:", err);
      toast.error(t("Failed to load real-time stock alerts", "Failed to load real-time stock alerts"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAlertData();
  }, [loadAlertData]);

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
    } catch (err: any) {
      toast.error(err?.message || "Failed to trigger stock digest");
    } finally {
      setSendingDigest(false);
    }
  };

  const stockouts = data?.stockout_items || [];
  const lowStock = data?.low_stock_items || [];
  const combinedList = [
    ...stockouts.map((i: any) => ({ ...i, isStockout: true })),
    ...lowStock.map((i: any) => ({ ...i, isStockout: false })),
  ];

  const filteredItems = combinedList.filter((item) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === "stockout") return matchesSearch && item.isStockout;
    if (activeFilter === "low_stock") return matchesSearch && !item.isStockout;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
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
            onClick={loadAlertData}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {t("Refresh", "Refresh")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfigModal(true)}
            className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border-indigo-500/40 text-xs font-semibold"
          >
            <Sliders className="size-3.5 mr-1.5" />
            {t("Alert Settings & WhatsApp", "Alert Settings & WhatsApp")}
          </Button>

          <Button
            size="sm"
            onClick={handleSendDigestNow}
            disabled={sendingDigest}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg text-xs font-semibold"
          >
            <Send className={`size-3.5 mr-1.5 ${sendingDigest ? "animate-spin" : ""}`} />
            {t("Broadcast WhatsApp Digest", "Broadcast WhatsApp Digest")}
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* AI Recommendation Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
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

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search by product name, SKU, category...", "Search by product name, SKU, category...")}
            className="pl-9 bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border w-full sm:w-auto overflow-x-auto">
          <Button
            size="sm"
            variant={activeFilter === "all" ? "default" : "ghost"}
            onClick={() => setActiveFilter("all")}
            className="text-xs h-8"
          >
            {t("All Alerts", "All Alerts")} ({combinedList.length})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === "stockout" ? "default" : "ghost"}
            onClick={() => setActiveFilter("stockout")}
            className={`text-xs h-8 ${activeFilter === "stockout" ? "bg-rose-600 text-white hover:bg-rose-700" : "text-rose-600"}`}
          >
            {t("Out of Stock", "Out of Stock")} ({stockouts.length})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === "low_stock" ? "default" : "ghost"}
            onClick={() => setActiveFilter("low_stock")}
            className={`text-xs h-8 ${activeFilter === "low_stock" ? "bg-amber-600 text-white hover:bg-amber-700" : "text-amber-600"}`}
          >
            {t("Low Stock", "Low Stock")} ({lowStock.length})
          </Button>
        </div>
      </div>

      {/* Product Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-6 animate-pulse bg-muted/30">
              <div className="h-5 bg-muted rounded w-24 mb-3" />
              <div className="h-6 bg-muted rounded w-48 mb-2" />
              <div className="h-4 bg-muted rounded w-32 mb-4" />
              <div className="h-16 bg-muted rounded mb-4" />
              <div className="h-9 bg-muted rounded" />
            </Card>
          ))}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const isStockout = item.isStockout;
            const stockPct = item.reorder_level > 0 ? Math.min(100, Math.round((item.stock / item.reorder_level) * 100)) : 0;

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
                <div className="text-xs text-muted-foreground font-mono mb-4">
                  SKU: {item.sku || "N/A"}
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
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <ShoppingCart className="size-3.5" />
                    {t("Create PO", "Create PO")}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!config.manager_whatsapp) {
                        toast.error(t("Set WhatsApp number in Settings first.", "Set WhatsApp number in Settings first."));
                        return;
                      }
                      inventoryAlertsApi.testWhatsApp({
                        phone_number: config.manager_whatsapp,
                        custom_message: `🚨 *Urgent Stock Reorder Alert:*\nItem: *${item.name}* (SKU: ${item.sku})\nCurrent Stock: *${item.stock} ${item.unit}*\nMin Reorder Point: *${item.reorder_level} ${item.unit}*\nStatus: ${isStockout ? "Out of Stock" : "Low Stock"}\nPlease issue purchase order.`,
                      });
                      toast.success(t("WhatsApp alert dispatched for this product!", "WhatsApp alert dispatched for this product!"));
                    }}
                    className="text-xs h-9 px-3 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
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
                  <div className="flex gap-2">
                    <Input
                      value={config.manager_whatsapp || ""}
                      onChange={(e) => setConfig({ ...config, manager_whatsapp: e.target.value })}
                      placeholder="e.g. +91 9876543210 or 9876543210"
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={handleTestWhatsApp}
                      disabled={testingWa || !config.manager_whatsapp}
                      className="shrink-0 text-emerald-600 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 text-xs"
                    >
                      <Zap className={`size-3.5 mr-1 ${testingWa ? "animate-spin" : ""}`} />
                      {t("Test Ping", "Test Ping")}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Accepts 10-digit mobile number or full international format (e.g. +919876543210).
                  </p>
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                    <div>
                      <div className="text-sm font-semibold">{t("In-App Push Alerts", "In-App Push Alerts")}</div>
                      <div className="text-xs text-muted-foreground">{t("Send real-time bell notification on low stock", "Send real-time bell notification on low stock")}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.low_stock_push !== false}
                      onChange={(e) => setConfig({ ...config, low_stock_push: e.target.checked })}
                      className="size-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                    <div>
                      <div className="text-sm font-semibold">{t("WhatsApp Low Stock Alerts", "WhatsApp Low Stock Alerts")}</div>
                      <div className="text-xs text-muted-foreground">{t("Send WhatsApp message when item drops below reorder level", "Send WhatsApp message when item drops below reorder level")}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.low_stock_whatsapp !== false}
                      onChange={(e) => setConfig({ ...config, low_stock_whatsapp: e.target.checked })}
                      className="size-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
                    <div>
                      <div className="text-sm font-semibold">{t("Dead Stock Alerts", "Dead Stock Alerts")}</div>
                      <div className="text-xs text-muted-foreground">{t("Alert on items with zero movement for extended period", "Alert on items with zero movement for extended period")}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.dead_stock_whatsapp !== false}
                      onChange={(e) => setConfig({ ...config, dead_stock_whatsapp: e.target.checked })}
                      className="size-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/30 border-t flex justify-end gap-2.5">
                <Button variant="ghost" onClick={() => setShowConfigModal(false)}>
                  {t("Cancel", "Cancel")}
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  {savingConfig ? t("Saving...", "Saving...") : t("Save Preferences", "Save Preferences")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
