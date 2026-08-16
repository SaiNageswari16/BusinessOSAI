import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, RefreshCw, Send, Trash2, Eye, ExternalLink,
  Loader2, Megaphone, DollarSign, MousePointerClick,
  Layers, Users, TrendingUp
} from "lucide-react";
import { paidAdsApi } from "@/lib/api-client";
import PaidCampaignBuilder from "./PaidCampaignBuilder";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

type TokenInfo = {
  connected: boolean;
  is_valid: boolean;
  page_id?: string;
  page_name?: string;
  token_type?: string;
  expires_at?: number | null;
  scopes?: string[];
  error?: string | null;
};

function PaidAdsSection({ tokenInfo }: { tokenInfo: TokenInfo | null }) {
    const { currency, formatCurrency } = useCurrency();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [insights, setInsights] = useState<{
    spend: string;
    impressions: string;
    clicks: string;
    ctr: string;
    reach: string;
    frequency: string;
  } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  const loadCampaigns = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res: any = await paidAdsApi.listCampaigns(p, 10);
      const items = res?.items ?? [];
      setCampaigns(items);
      setTotalPages(res?.total_pages ?? Math.max(1, Math.ceil((res?.total ?? 0) / 10)));
      setPage(res?.page ?? p);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCampaigns = useCallback(async () => {
    setRefreshing(true);
    await loadCampaigns(1);
    setRefreshing(false);
    toast.success("Campaigns refreshed.");
  }, [loadCampaigns]);

  useEffect(() => {
    loadCampaigns(1);
  }, [loadCampaigns]);

  const handleActivate = async (campaignId: string, status: "ACTIVE" | "PAUSED") => {
    setActivating(campaignId);
    try {
      await paidAdsApi.activateAd(campaignId, { status });
      toast.success(status === "ACTIVE" ? "Campaign submitted to Meta for review." : "Campaign paused.");
      refreshCampaigns();
    } catch (err: any) {
      toast.error(err?.detail || `Failed to ${status === "ACTIVE" ? "activate" : "pause"} campaign.`);
    } finally {
      setActivating(null);
    }
  };

  const handleArchive = async (campaignId: string) => {
    if (!confirm("Delete this campaign? This action cannot be undone.")) return;
    setArchiving(campaignId);
    try {
      await paidAdsApi.archiveCampaign(campaignId);
      toast.success("Campaign archived.");
      setCampaigns((c) => c.filter((c) => c.id !== campaignId));
    } catch (err: any) {
      toast.error(err?.detail || "Failed to archive campaign.");
    } finally {
      setArchiving(null);
    }
  };

  const handleViewInsights = async (campaignId: string) => {
    setSelectedCampaign(campaignId);
    setLoadingInsights(true);
    try {
      const res = await paidAdsApi.getCampaignInsights(campaignId);
      setInsights(res as any);
    } catch {
      toast.error("Failed to load insights.");
      setSelectedCampaign(null);
    } finally {
      setLoadingInsights(false);
    }
  };

  const formatRupees = (cents: number) =>
    `₹${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!tokenInfo?.connected) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Connect your Facebook Page to start running paid ads.</p>
      </div>
    );
  }

  if (!tokenInfo || !tokenInfo.connected) {
    return (
      <div className="py-12 text-center border border-border rounded-xl bg-card">
        <h3 className="font-bold text-foreground">No Facebook Page Connected</h3>
        <p className="text-xs text-muted-foreground mt-1">Connect your Facebook Page in the Ad Generator to manage paid campaigns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Builder toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Paid Ad Campaigns</h3>
          <p className="text-xs text-muted-foreground">
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} &bull; Connected to{" "}
            <span className="font-semibold text-foreground">{tokenInfo.page_name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshCampaigns}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${showBuilder
                ? "bg-muted text-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
          >
            {showBuilder ? (
              <>
                <X className="size-3.5" /> Close Builder
              </>
            ) : (
              <>
                <Plus className="size-3.5" /> New Paid Campaign
              </>
            )}
          </button>
        </div>
      </div>

      {/* Builder */}
      <AnimatePresence>
        {showBuilder && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <PaidCampaignBuilder
              onCreated={() => {
                setShowBuilder(false);
                refreshCampaigns();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
          <Megaphone className="size-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-semibold text-foreground">No paid campaigns yet</p>
          <p className="text-xs text-muted-foreground">Build your first paid campaign to start driving results.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign</th>
                  <th className="text-left p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Objective</th>
                  <th className="text-left p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Spend</th>
                  <th className="text-right p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {/* Ad thumbnail */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                          {camp.ad_image_url ? (
                            <img
                              src={camp.ad_image_url}
                              alt={camp.ad_headline || camp.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <Megaphone className="size-5 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate max-w-[160px]">
                            {camp.ad_headline || camp.name}
                          </p>
                          {camp.ad_body && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                              {camp.ad_body}
                            </p>
                          )}
                          <p className="text-[10px] font-mono text-muted-foreground/60">{camp.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px] font-semibold">
                        {(camp.objective || "UNKNOWN").replace("OUTCOME_", "")}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${camp.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : camp.status === "PAUSED"
                              ? "bg-amber-500/10 text-amber-600"
                              : camp.status === "DELETED"
                                ? "bg-red-500/10 text-red-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {camp.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono font-semibold text-foreground text-right">
                      {camp.spend_cents ? formatRupees(camp.spend_cents) : <span className="text-muted-foreground">&mdash;</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewInsights(camp.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          title="View Insights & Details"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        {tokenInfo?.ad_account_id && (
                          <a
                            href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${tokenInfo.ad_account_id.replace("act_", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-colors cursor-pointer"
                            title="View Live Ad in Meta Ads Manager"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        {camp.status !== "DELETED" && (
                          <>
                            <button
                              onClick={() => handleActivate(camp.id || camp.meta_campaign_id, camp.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                              disabled={activating === (camp.id || camp.meta_campaign_id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                                camp.status === "ACTIVE"
                                  ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              }`}
                              title={camp.status === "ACTIVE" ? "Click to Pause" : "Click to Activate"}
                            >
                              {activating === (camp.id || camp.meta_campaign_id) ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3" />
                              )}
                              {camp.status === "ACTIVE" ? "Pause" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleArchive(camp.id)}
                              disabled={archiving === camp.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
                              title="Archive"
                            >
                              {archiving === camp.id ? (
                                <Loader2 className="size-3.5 animate-spin text-red-400" />
                              ) : (
                                <Trash2 className="size-3.5 text-red-400/70" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-border">
              <button
                onClick={() => loadCampaigns(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-[11px] text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => loadCampaigns(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Insights drawer */}
      <AnimatePresence>
        {selectedCampaign && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-card border border-border rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">Campaign Insights</h4>
              <button
                onClick={() => { setSelectedCampaign(null); setInsights(null); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {loadingInsights ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : insights ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Spend", value: `₹${parseFloat(insights.spend).toFixed(2)}`, icon: DollarSign },
                  { label: "Impressions", value: parseInt(insights.impressions).toLocaleString(), icon: Eye },
                  { label: "Clicks", value: parseInt(insights.clicks).toLocaleString(), icon: MousePointerClick },
                  { label: "CTR", value: `${parseFloat(insights.ctr).toFixed(2)}%`, icon: Layers },
                  { label: "Reach", value: parseInt(insights.reach).toLocaleString(), icon: Users },
                  { label: "Frequency", value: `${parseFloat(insights.frequency).toFixed(2)}×`, icon: TrendingUp },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-xl bg-muted/40 border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <m.icon className="size-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{m.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No insights available.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PaidAdsSection;
