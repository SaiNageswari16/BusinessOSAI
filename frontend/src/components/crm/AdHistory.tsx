import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  History, RefreshCw, Copy, ExternalLink, Facebook,
  CheckCircle, AlertCircle, Clock, AlertTriangle, Shield,
  Sparkles, ChevronRight, ImageIcon, FileText, ArrowRight,
  Info, Loader2, WifiOff, TrendingUp, Megaphone, UserCheck,
  DollarSign, Eye, MousePointerClick, Layers
} from "lucide-react";
import { crmLeadsApi } from "@/lib/api-client";
import PaidCampaignBuilder from "./PaidCampaignBuilder";
import PaidAdsSection from "./PaidAdsSection";
import { toast } from "sonner";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";

// ── Types ────────────────────────────────────────────────────────────────────

type AdHistoryItem = {
  id: string;
  post_id?: string;
  page_id?: string;
  page_name?: string;
  caption?: string;
  image_url?: string;
  fb_post_url?: string;
  published_at?: string;
  published_by_user_id?: string;
};

type TokenInfo = {
  connected: boolean;
  is_valid: boolean;
  page_id?: string;
  page_name?: string;
  token_type?: string;
  expires_at?: number | null;
  scopes?: string[];
  error?: string | null;
  ad_account_id?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied!`);
  });
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDaysUntilExpiry(expiresAt?: number | null): number | null {
  if (!expiresAt) return null;
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil((expiresAt - now) / 86400);
}

// ── Token Health Card ─────────────────────────────────────────────────────────

function TokenHealthCard({ tokenInfo, loading }: { tokenInfo: TokenInfo | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card animate-pulse">
        <Loader2 className="size-4 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Checking token health…</span>
      </div>
    );
  }

  if (!tokenInfo || !tokenInfo.connected) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground">
        <WifiOff className="size-4 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold">No Facebook page connected</p>
          <p className="text-[11px] mt-0.5">Go to <span className="font-bold">Marketing Ad Generator</span> → Connect FB Page to set up your token.</p>
        </div>
      </div>
    );
  }

  const daysLeft = getDaysUntilExpiry(tokenInfo.expires_at);
  const isPageToken = tokenInfo.token_type === "page" || !tokenInfo.expires_at;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isWarning = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;

  let statusColor = "emerald";
  let StatusIcon = CheckCircle;
  let statusLabel = "";
  let statusDesc = "";

  if (!tokenInfo.is_valid || isExpired) {
    statusColor = "red";
    StatusIcon = AlertCircle;
    statusLabel = "Token Expired / Invalid";
    statusDesc = tokenInfo.error || "Your access token is no longer valid. Generate a fresh one from developers.facebook.com and reconnect.";
  } else if (isWarning) {
    statusColor = "amber";
    StatusIcon = AlertTriangle;
    statusLabel = `Token Expires in ${daysLeft} days`;
    statusDesc = "Please renew your user token before it expires to prevent automated lead generation downtime.";
  } else {
    statusLabel = isPageToken ? "Page Access Token Connected (Never Expires)" : "User Access Token Connected (Valid)";
    statusDesc = `Ready to sync leads and campaigns. Granted scopes: ${tokenInfo.scopes?.join(", ") || "ads_read, leads_retrieval, pages_show_list"}`;
  }

  return (
    <div className={`p-4 rounded-xl border border-${statusColor}-500/20 bg-${statusColor}-500/5 flex items-start gap-3`}>
      <StatusIcon className={`size-4 text-${statusColor}-500 flex-shrink-0 mt-0.5`} />
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-foreground">{statusLabel}</h4>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{statusDesc}</p>
        {tokenInfo.page_name && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span className="text-[10px] text-muted-foreground">Connected Page: <strong className="text-foreground">{tokenInfo.page_name}</strong></span>
            <span className="text-[10px] text-muted-foreground">Page ID: <strong className="text-foreground font-mono">{tokenInfo.page_id}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Published Ad Card ────────────────────────────────────────────────────────

function AdCard({ item, onUseForLeads }: { item: AdHistoryItem; onUseForLeads: (pageId: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
    >
      {/* Image container */}
      <div className="h-40 bg-muted relative overflow-hidden flex-shrink-0 border-b border-border">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.caption || "Published ad image"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1 bg-gradient-to-br from-muted to-muted/40">
            <ImageIcon className="size-8 opacity-40" />
            <span className="text-[10px] font-semibold tracking-wide uppercase opacity-60">Text Only Post</span>
          </div>
        )}

        {/* Published badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow">
          <CheckCircle className="size-2.5" />
          Published
        </div>

        {/* FB link */}
        {item.fb_post_url && (
          <a
            href={item.fb_post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-white/10 backdrop-blur text-white text-[10px] font-semibold rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
          >
            <Facebook className="size-3 text-blue-400" />
            View Post
            <ExternalLink className="size-2.5" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="space-y-6 flex-grow flex flex-col justify-between">
        <div className="space-y-3">
          {item.caption && (
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
              {item.caption}
            </p>
          )}

          {/* Metadata grid */}
          <div className="space-y-1.5">
            {item.post_id && (
              <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-muted/40 rounded-lg">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="size-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground font-medium">Post ID</span>
                  <span className="text-[10px] text-foreground font-mono truncate">{item.post_id}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(item.post_id!, "Post ID")}
                  className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                  title="Copy Post ID"
                >
                  <Copy className="size-3 text-muted-foreground" />
                </button>
              </div>
            )}

            {item.page_id && (
              <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Facebook className="size-3 text-blue-500 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground font-medium">Page ID</span>
                  <span className="text-[10px] text-foreground font-mono truncate">{item.page_id}</span>
                  {item.page_name && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate">({item.page_name})</span>
                  )}
                </div>
                <button
                  onClick={() => copyToClipboard(item.page_id!, "Page ID")}
                  className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                  title="Copy Page ID"
                >
                  <Copy className="size-3 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="size-3" />
            {formatDate(item.published_at)}
          </div>

          {item.page_id && (
            <button
              onClick={() => onUseForLeads(item.page_id!)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors border border-primary/20 cursor-pointer"
            >
              Use for Lead Sync
              <ArrowRight className="size-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-card border border-border rounded-2xl">
      <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/15 flex items-center justify-center mb-4">
        <History className="size-7 text-blue-500/60" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-2">No published ads yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Once you publish an organic ad from the <span className="font-semibold text-foreground">Marketing Ad Generator</span>, it will appear here with its Post ID and Page ID.
      </p>
      <a
        href="/crm?tab=ad_generator"
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
      >
        <Sparkles className="size-4" />
        Go to Ad Generator
        <ChevronRight className="size-4" />
      </a>
    </div>
  );
}

// ── Lead Sync Toast ──────────────────────────────────────────────────────────

function LeadSyncToast({ pageId }: { pageId: string }) {
  return (
    <div className="flex items-start gap-3">
      <Info className="size-4 text-blue-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">Page ID Copied!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Select the <strong>Lead Form Sync</strong> tab on this dashboard to automatically import leads from forms linked to Page ID: <br />
          <code className="font-mono text-xs bg-muted px-1 rounded">{pageId}</code>.
        </p>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD COMPONENT ──────────────────────────────────────────────────

export function AdHistory() {
    const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  // Organic history posts states
  const [ads, setAds] = useState<AdHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Connection & token states
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<"published" | "campaigns" | "paid" | "sync">("published");

  // Ad Campaigns RAG states
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Lead Sync States
  const [syncingLeads, setSyncingLeads] = useState(false);

  // ── Fetch token health ──────────────────────────────────────────────────────
  const fetchTokenInfo = useCallback(async () => {
    setTokenLoading(true);
    try {
      const info = await crmLeadsApi.getFbTokenInfo();
      setTokenInfo(info);
    } catch {
      setTokenInfo({ connected: false, is_valid: false });
    } finally {
      setTokenLoading(false);
    }
  }, []);

  // ── Fetch ad history ────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async (p = 1, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await crmLeadsApi.getAdHistory(p, 12);
      setAds(res.items);
      setTotal(res.total);
      setPage(p);
    } catch (err) {
      console.error("Failed to fetch ad history:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Fetch ad accounts ───────────────────────────────────────────────────────
  const fetchAdAccounts = useCallback(async () => {
    try {
      const accounts = await crmLeadsApi.getFbAdAccounts();
      setAdAccounts(accounts);
      if (accounts.length > 0) {
        const savedId = (tokenInfo as any)?.ad_account_id;
        const exists = accounts.some((acc: any) => acc.account_id === savedId);
        const targetId = exists ? savedId : accounts[0].account_id;

        setSelectedAdAccount(targetId);
        if (targetId !== savedId) {
          await handleSelectAdAccount(targetId);
        } else {
          setCampaignsLoading(true);
          try {
            const res = await crmLeadsApi.getFbCampaigns();
            setCampaigns(res);
          } catch (err) {
            console.error("Failed to fetch campaigns:", err);
            setCampaigns([]);
          } finally {
            setCampaignsLoading(false);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch ad accounts:", err);
    }
  }, [tokenInfo]);

  // ── Select active Ad Account ────────────────────────────────────────────────
  const handleSelectAdAccount = async (accountId: string) => {
    setSelectedAdAccount(accountId);
    try {
      await crmLeadsApi.selectFbAdAccount(accountId);
      fetchCampaigns();
    } catch (err) {
      toast.error("Failed to select Ad Account");
    }
  };

  // ── Fetch campaigns ─────────────────────────────────────────────────────────
  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const res = await crmLeadsApi.getFbCampaigns();
      setCampaigns(res);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  };

  // ── Sync Lead gen forms ─────────────────────────────────────────────────────
  const triggerLeadSync = async () => {
    setSyncingLeads(true);
    try {
      const res = await crmLeadsApi.syncFbLeads();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to synchronize lead submissions.");
    } finally {
      setSyncingLeads(false);
    }
  };

  useEffect(() => {
    fetchTokenInfo();
    fetchHistory(1);
  }, [tenant.id, fetchTokenInfo, fetchHistory]);

  useEffect(() => {
    if (tokenInfo?.connected && tokenInfo.is_valid && activeTab === "campaigns" && adAccounts.length === 0) {
      fetchAdAccounts();
    }
  }, [activeTab, tokenInfo, fetchAdAccounts, adAccounts.length]);

  const handleRefresh = () => {
    fetchTokenInfo();
    if (activeTab === "published") {
      fetchHistory(1, true);
    } else if (activeTab === "campaigns") {
      fetchCampaigns();
    }
  };

  const handleUseForLeads = (pageId: string) => {
    copyToClipboard(pageId, "Page ID");
    toast.custom(() => <LeadSyncToast pageId={pageId} />, { duration: 8000 });
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="p-4 min-h-[calc(100vh-6rem)] flex flex-col space-y-3 bg-background">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Facebook Marketing & Campaign Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze campaigns insights, publish organic post history, and synchronize Lead Ads submissions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end">
          <button
            onClick={handleRefresh}
            disabled={refreshing || campaignsLoading}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${refreshing || campaignsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate({ to: "/crm", search: { tab: "ad_generator" } })}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="size-3.5" />
            Create Ad Poster
          </button>
        </div>
      </div>

      {/* ── Token Health Card ── */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="size-3" />
          Facebook Token Health
        </p>
        <TokenHealthCard tokenInfo={tokenInfo} loading={tokenLoading} />
      </div>

      {/* ── Tab Selector Navigation ── */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("published")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "published"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Organic Published Posts
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "campaigns"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Meta Campaigns & Insights
        </button>
        <button
          onClick={() => setActiveTab("paid")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "paid"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Paid Ads Builder
        </button>
        <button
          onClick={() => setActiveTab("sync")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "sync"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Leads Auto-Sync
        </button>
      </div>

      {/* ── Render Tab Views ── */}
      {activeTab === "published" && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl text-xs text-blue-700 dark:text-blue-400">
            <Info className="size-3.5 flex-shrink-0 mt-0.5" />
            <p>
              <span className="font-bold">Tip:</span> Click <span className="font-bold">Use for Lead Sync</span> on any card to copy that Page ID and trigger lead form syncs immediately.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-36 bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-7 bg-muted rounded-lg mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : ads.length === 0 ? (
            <EmptyState />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {ads.map((item) => (
                  <AdCard key={item.id} item={item} onUseForLeads={handleUseForLeads} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => fetchHistory(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
              >
                ← Previous
              </button>
              <span className="text-xs text-muted-foreground px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => fetchHistory(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold disabled:opacity-40 hover:bg-muted transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="space-y-6">
          {/* Ad Account Selector */}
          {adAccounts.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-card border border-border rounded-xl">
              <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground flex-shrink-0">
                  <Layers className="size-4 text-blue-500" />
                  Select Facebook Ad Account:
                </div>
                <select
                  value={selectedAdAccount}
                  onChange={(e) => handleSelectAdAccount(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none w-full md:w-80 cursor-pointer"
                >
                  {adAccounts.map((acc) => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.name} ({acc.account_id})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={triggerLeadSync}
                disabled={syncingLeads || !tokenInfo?.connected}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-end md:self-auto"
              >
                {syncingLeads ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Syncing Leads…
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5" />
                    Sync Leads from Meta Forms
                  </>
                )}
              </button>
            </div>
          )}

          {/* Campaigns Metrics */}
          {campaignsLoading ? (
            <div className="space-y-3">
              <div className="h-10 bg-card border border-border rounded-xl animate-pulse" />
              <div className="h-32 bg-card border border-border rounded-xl animate-pulse" />
            </div>
          ) : !selectedAdAccount ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
              <WifiOff className="size-10 text-muted-foreground/60 mb-3" />
              <h3 className="text-sm font-bold text-foreground">No active ad account configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Generate an access token with <strong>ads_read</strong> scope to list and inspect campaigns.
              </p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
              <Megaphone className="size-10 text-muted-foreground/60 mb-3" />
              <h3 className="text-sm font-bold text-foreground">No Campaigns Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                No active or paused marketing campaigns found under Ad Account ID {selectedAdAccount}.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider min-w-[180px]">Campaign Name</th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Objective</th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1"><DollarSign className="size-3.5" /> Spend</div>
                      </th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1"><Eye className="size-3.5" /> Impressions</div>
                      </th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Reach</th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Frequency</th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1"><MousePointerClick className="size-3.5" /> Clicks</div>
                      </th>
                      <th className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1"><TrendingUp className="size-3.5" /> CTR</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((camp) => {
                      const spend = parseFloat(camp.spend || "0");
                      const imps = parseInt(camp.impressions || "0", 10);
                      const clicks = parseInt(camp.clicks || "0", 10);
                      const reach = parseInt(camp.reach || "0", 10);
                      const frequency = parseFloat(camp.frequency || "0");
                      // Use CTR from API (already a percentage string like "0.497"), or calculate as fallback
                      const ctrRaw = parseFloat(camp.ctr || "0");
                      const ctr = ctrRaw > 0 ? ctrRaw.toFixed(2) + "%" : imps > 0 ? ((clicks / imps) * 100).toFixed(2) + "%" : "0.00%";

                      const isActive = camp.status?.toUpperCase() === "ACTIVE";
                      const hasData = spend > 0 || imps > 0;

                      return (
                        <tr key={camp.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-xs text-foreground leading-tight">{camp.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {camp.id}</div>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                            }`}>
                              {camp.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px] font-semibold">
                              {(camp.objective || "UNKNOWN").replace("OUTCOME_", "")}
                            </span>
                          </td>
                          <td className="p-3 text-xs font-mono font-semibold text-foreground">
                            {hasData ? `₹${spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-xs font-mono text-foreground">
                            {hasData ? imps.toLocaleString() : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-xs font-mono text-foreground">
                            {reach > 0 ? reach.toLocaleString() : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-xs font-mono text-foreground">
                            {frequency > 0 ? frequency.toFixed(2) + "×" : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-xs font-mono text-foreground">
                            {hasData ? clicks.toLocaleString() : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                            {hasData ? ctr : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "paid" && (
        <div className="space-y-6">
          <PaidAdsSection tokenInfo={tokenInfo} />
        </div>
      )}

      {activeTab === "sync" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 max-w-2xl">
            <div className="size-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
              <UserCheck className="size-5 text-white" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Synchronize Facebook Lead Forms</h3>
              <p className="text-xs text-muted-foreground">
                Automatically fetch form submissions from Facebook Ads running on your connected page and import them directly to your CRM Contacts list.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={triggerLeadSync}
                disabled={syncingLeads || !tokenInfo?.connected}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncingLeads ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Synchronizing Leads…
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5" />
                    Sync Leads Now
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">Form Mapping Mechanics:</span> Our importer checks submissions every sync and automatically maps columns like <code>Full Name</code>, <code>Email</code>, <code>Phone Number</code>, and <code>Company Name</code> into standard leads. Duplicate submissions are automatically skipped using Meta's unique submission ID.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
