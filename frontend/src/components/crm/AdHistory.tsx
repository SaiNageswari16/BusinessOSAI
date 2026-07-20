import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History, RefreshCw, Copy, ExternalLink, Facebook,
  CheckCircle, AlertCircle, Clock, AlertTriangle, Shield,
  Sparkles, ChevronRight, ImageIcon, FileText, ArrowRight,
  Info, Loader2, WifiOff
} from "lucide-react";
import { crmLeadsApi } from "@/lib/api-client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/tenant-context";

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
    statusLabel = `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    statusDesc = "This token is expiring soon. Refresh it before it stops working.";
  } else if (isPageToken) {
    statusColor = "emerald";
    StatusIcon = Shield;
    statusLabel = "Page Token — Non-Expiring";
    statusDesc = "Page Access Tokens for pages you manage never expire. No action needed.";
  } else {
    statusColor = "emerald";
    StatusIcon = CheckCircle;
    statusLabel = daysLeft ? `Valid — expires in ${daysLeft} days` : "Valid";
    statusDesc = "Your token is active and healthy.";
  }

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400",
    amber: "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400",
    red: "bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-400",
  };
  const iconColorMap: Record<string, string> = {
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    red: "text-red-500",
  };

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${colorMap[statusColor]}`}>
      <StatusIcon className={`size-4 flex-shrink-0 mt-0.5 ${iconColorMap[statusColor]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-bold">{statusLabel}</p>
          {tokenInfo.page_name && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-semibold text-blue-600 dark:text-blue-400">
              <Facebook className="size-2.5" />
              {tokenInfo.page_name}
            </span>
          )}
          {tokenInfo.token_type && (
            <span className="px-2 py-0.5 bg-background/50 border border-border rounded-full text-[10px] text-muted-foreground capitalize">
              {tokenInfo.token_type} token
            </span>
          )}
        </div>
        <p className="text-[11px] mt-0.5 opacity-80">{statusDesc}</p>
        {(isExpired || isWarning) && (
          <a
            href="https://developers.facebook.com/tools/explorer/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold underline underline-offset-2"
          >
            Refresh Token in Meta Explorer <ExternalLink className="size-3" />
          </a>
        )}
        {tokenInfo.scopes && tokenInfo.scopes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tokenInfo.scopes.map(s => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-background/60 border border-border text-[10px] text-muted-foreground font-mono">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ad Card ───────────────────────────────────────────────────────────────────

function AdCard({ item, onUseForLeads }: { item: AdHistoryItem; onUseForLeads: (pageId: string) => void }) {
  const [imgError, setImgError] = useState(false);
  const isLocalImage = item.image_url?.includes("localhost") || item.image_url?.startsWith("data:");
  const showThumb = !imgError && item.image_url && !isLocalImage;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300"
    >
      {/* Thumbnail strip */}
      <div className="relative h-36 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden flex-shrink-0">
        {showThumb ? (
          <img
            src={item.image_url}
            alt="Ad poster"
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="size-8 text-slate-600" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

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
      <div className="p-4 space-y-3">
        {/* Caption preview */}
        {item.caption && (
          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
            {item.caption}
          </p>
        )}

        {/* Metadata grid */}
        <div className="space-y-1.5">
          {/* Post ID */}
          {item.post_id && (
            <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-muted/40 rounded-lg">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="size-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground font-medium">Post ID</span>
                <span className="text-[10px] text-foreground font-mono truncate">{item.post_id}</span>
              </div>
              <button
                onClick={() => copyToClipboard(item.post_id!, "Post ID")}
                className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
                title="Copy Post ID"
              >
                <Copy className="size-3 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Page ID */}
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
                className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
                title="Copy Page ID"
              >
                <Copy className="size-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="size-3" />
            {formatDate(item.published_at)}
          </div>

          {item.page_id && (
            <button
              onClick={() => onUseForLeads(item.page_id!)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors border border-primary/20"
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
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/15 flex items-center justify-center mb-4">
        <History className="size-7 text-blue-500/60" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-2">No published ads yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Once you publish a campaign from the <span className="font-semibold text-foreground">Marketing Ad Generator</span>, it will appear here with its Post ID, Page ID, and metadata.
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

// ── Lead Sync Modal ──────────────────────────────────────────────────────────

function LeadSyncToast({ pageId }: { pageId: string }) {
  return (
    <div className="flex items-start gap-3">
      <Info className="size-4 text-blue-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold">Page ID Ready to Use</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Navigate to <strong>Leads → FB Lead Ads</strong> and paste this Page ID:<br />
          <code className="font-mono text-xs bg-muted px-1 rounded">{pageId}</code>
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AdHistory() {
  const { tenant } = useTenant();

  const [ads, setAds] = useState<AdHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);

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

  useEffect(() => {
    fetchTokenInfo();
    fetchHistory(1);
  }, [tenant.id, fetchTokenInfo, fetchHistory]);

  const handleRefresh = () => {
    fetchTokenInfo();
    fetchHistory(1, true);
  };

  const handleUseForLeads = (pageId: string) => {
    copyToClipboard(pageId, "Page ID");
    toast.custom(() => <LeadSyncToast pageId={pageId} />, { duration: 8000 });
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="p-6 min-h-[calc(100vh-6rem)] flex flex-col space-y-6 bg-background">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="size-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <History className="size-4 text-white" />
            </div>
            Published Ad History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track every ad published to Facebook — copy Post IDs, Page IDs, and monitor token health.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end">
          <span className="text-xs text-muted-foreground px-3 py-1.5 bg-muted rounded-xl border border-border">
            {total} post{total !== 1 ? "s" : ""} total
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a
            href="/crm?tab=ad_generator"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="size-3.5" />
            Create New Ad
          </a>
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

      {/* ── Info Banner ── */}
      <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl text-xs text-blue-700 dark:text-blue-400">
        <Info className="size-3.5 flex-shrink-0 mt-0.5" />
        <p>
          <span className="font-bold">Tip:</span> Click <span className="font-bold">Use for Lead Sync</span> on any card to copy that Page ID and use it in the <span className="font-bold">Leads → FB Lead Ads</span> tab to fetch form submissions from that page.
        </p>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
              <div className="h-36 bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-7 bg-muted rounded-lg mt-3" />
                <div className="h-7 bg-muted rounded-lg" />
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

      {/* ── Pagination ── */}
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
  );
}
