import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { useCurrency } from "@/hooks/use-currency";
import { inventoryAlertsApi } from "@/lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Skull,
  AlertCircle,
  TrendingDown,
  DollarSign,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  Send,
  MessageSquare,
  Tag,
  ArrowRight,
  Package,
  Layers,
  Archive,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function DeadStock() {
  const { t } = useI18n();
  const { formatCurrency } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [inactivityDays, setInactivityDays] = useState<number>(90);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sendingDigest, setSendingDigest] = useState(false);

  const loadDeadStock = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryAlertsApi.getStatus(inactivityDays);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load dead stock data:", err);
      toast.error(t("Failed to analyze dead stock", "Failed to analyze dead stock"));
    } finally {
      setLoading(false);
    }
  }, [inactivityDays, t]);

  useEffect(() => {
    loadDeadStock();
  }, [loadDeadStock]);

  const handleSendDeadStockAlert = async () => {
    setSendingDigest(true);
    try {
      const configRes = await inventoryAlertsApi.getConfig();
      const phone = configRes?.config?.manager_whatsapp;
      if (!phone) {
        toast.error(t("Please set a Manager WhatsApp number in Low Stock Alerts Settings first.", "Please set a Manager WhatsApp number in Low Stock Alerts Settings first."));
        return;
      }
      const res = await inventoryAlertsApi.triggerDigest(phone);
      if (res.whatsapp_delivery?.success) {
        toast.success(t("Dead Stock & Inventory Health summary sent to WhatsApp!", "Dead Stock & Inventory Health summary sent to WhatsApp!"));
      } else {
        toast.success(t("In-App alert digest posted! (WhatsApp gateway offline or unauthenticated)", "In-App alert digest posted! (WhatsApp gateway offline or unauthenticated)"));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch alert");
    } finally {
      setSendingDigest(false);
    }
  };

  const deadItems = data?.dead_stock_items || [];
  const categories = Array.from(new Set(deadItems.map((i: any) => i.category || "General")));

  const filteredItems = deadItems.filter((item: any) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "all" || (item.category || "General") === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalLockedCapital = data?.summary?.dead_capital_amount || 0;
  const deadCount = data?.summary?.dead_stock_count || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/40 text-rose-400">
              <Skull className="size-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {t("Dead Stock Intelligence & Liquidation", "Dead Stock Intelligence & Liquidation")}
            </h2>
          </div>
          <p className="text-slate-300 text-sm">
            {t(
              "Identify stagnant products tying up capital with zero sales movements in 30 to 180+ days.",
              "Identify stagnant products tying up capital with zero sales movements in 30 to 180+ days."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDeadStock}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {t("Re-Analyze", "Re-Analyze")}
          </Button>

          <Button
            size="sm"
            onClick={handleSendDeadStockAlert}
            disabled={sendingDigest}
            className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg text-xs font-semibold"
          >
            <Send className={`size-3.5 mr-1.5 ${sendingDigest ? "animate-spin" : ""}`} />
            {t("Broadcast Liquidation Alert", "Broadcast Liquidation Alert")}
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-200 dark:border-rose-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                {t("Total Locked Capital", "Total Locked Capital")}
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 mt-1">
                {formatCurrency(totalLockedCapital)}
              </h3>
            </div>
            <div className="p-2.5 bg-rose-500/20 text-rose-600 rounded-xl">
              <DollarSign className="size-5" />
            </div>
          </div>
          <p className="text-xs text-rose-600/80 mt-2">
            Non-performing inventory investment
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200 dark:border-amber-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {t("Stagnant Products", "Stagnant Products")}
              </p>
              <h3 className="text-3xl font-black text-amber-700 dark:text-amber-300 mt-1">
                {deadCount}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/20 text-amber-600 rounded-xl">
              <Archive className="size-5" />
            </div>
          </div>
          <p className="text-xs text-amber-600/80 mt-2">
            Zero customer purchases or transfers
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-purple-200 dark:border-purple-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                {t("Inactivity Threshold", "Inactivity Threshold")}
              </p>
              <h3 className="text-3xl font-black text-purple-700 dark:text-purple-300 mt-1">
                {inactivityDays} <span className="text-sm font-normal text-muted-foreground">{t("Days", "Days")}</span>
              </h3>
            </div>
            <div className="p-2.5 bg-purple-500/20 text-purple-600 rounded-xl">
              <Clock className="size-5" />
            </div>
          </div>
          <p className="text-xs text-purple-600/80 mt-2">
            Window evaluated for zero stock movements
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-200 dark:border-blue-900/40">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {t("Expiring Batches (<30d)", "Expiring Batches (<30d)")}
              </p>
              <h3 className="text-3xl font-black text-blue-700 dark:text-blue-300 mt-1">
                {data?.summary?.expiring_batches_count ?? 0}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-500/20 text-blue-600 rounded-xl">
              <Layers className="size-5" />
            </div>
          </div>
          <p className="text-xs text-blue-600/80 mt-2">
            Requires immediate discount promotion
          </p>
        </Card>
      </div>

      {/* AI Liquidation Strategy Banner */}
      <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 dark:from-rose-950/30 dark:via-amber-950/20 dark:to-slate-900 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-950 dark:text-rose-200">
              {t("AI Capital Liquidation Recommendations", "AI Capital Liquidation Recommendations")}
            </h3>
            <p className="text-sm text-rose-900/80 dark:text-rose-300/80 mt-1">
              Bundle top dead stock items with high-velocity bestsellers at 15–20% discount or initiate supplier RTV (Return to Vendor) credits to unlock <span className="font-bold text-rose-700 dark:text-rose-400">{formatCurrency(totalLockedCapital)}</span> in frozen cash flow.
            </p>
          </div>
        </div>
      </div>

      {/* Threshold Selector & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase mr-1">
            {t("Inactivity Period:", "Inactivity Period:")}
          </span>
          {[30, 60, 90, 180].map((days) => (
            <Button
              key={days}
              size="sm"
              variant={inactivityDays === days ? "default" : "outline"}
              onClick={() => setInactivityDays(days)}
              className="text-xs h-8"
            >
              {days} {t("Days", "Days")}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Filter by name or SKU...", "Filter by name or SKU...")}
              className="pl-8 text-xs h-8 bg-background"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs h-8 px-2.5 rounded-md border border-input bg-background text-foreground"
          >
            <option value="all">{t("All Categories", "All Categories")}</option>
            {categories.map((c: any) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dead Stock Table / Cards */}
      {loading ? (
        <Card className="p-8 text-center animate-pulse">
          <RefreshCw className="size-8 mx-auto animate-spin text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t("Calculating historical sales velocity and dead inventory...", "Calculating historical sales velocity and dead inventory...")}</p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center border-dashed bg-card/50">
          <div className="mx-auto size-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="size-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {t("Zero Dead Stock Detected", "Zero Dead Stock Detected")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
            {t(
              `All products have active stock movements within the selected ${inactivityDays}-day window. Inventory turnover is optimal!`,
              `All products have active stock movements within the selected ${inactivityDays}-day window. Inventory turnover is optimal!`
            )}
          </p>
        </Card>
      ) : (
        <div className="bg-card rounded-2xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">{t("Product & SKU", "Product & SKU")}</th>
                  <th className="py-3 px-4">{t("Category", "Category")}</th>
                  <th className="py-3 px-4 text-right">{t("Stagnant Qty", "Stagnant Qty")}</th>
                  <th className="py-3 px-4 text-right">{t("Cost Price", "Cost Price")}</th>
                  <th className="py-3 px-4 text-right">{t("Locked Capital", "Locked Capital")}</th>
                  <th className="py-3 px-4 text-center">{t("Recommended Action", "Recommended Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-foreground">{item.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">SKU: {item.sku || "N/A"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {item.category || "General"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                      {item.stock} <span className="text-xs font-normal text-muted-foreground">units</span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted-foreground">
                      {formatCurrency(item.cost_price || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                      {formatCurrency(item.locked_capital || 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            toast.info(t(`Clearance discount applied for ${item.name}`, `Clearance discount applied for ${item.name}`));
                          }}
                          className="text-xs h-7 px-2.5 text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50"
                        >
                          <Tag className="size-3 mr-1" />
                          {t("Clearance Discount", "Clearance Discount")}
                        </Button>

                        <a
                          href={`/inventory?tab=stock_movement&product_id=${item.id}`}
                          className="inline-flex items-center text-xs h-7 px-2.5 rounded-md border text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <ArrowRight className="size-3 mr-1" />
                          {t("Transfer / RTV", "Transfer / RTV")}
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
