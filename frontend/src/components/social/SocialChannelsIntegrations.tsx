import React, { useState, useEffect } from "react";
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Video,
  Globe,
  Camera,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { socialMediaApi, type SocialAccountItem } from "@/lib/api-client";
import { useRbac } from "@/contexts/rbac-context";

interface PlatformDef {
  id: "facebook" | "instagram" | "twitter" | "google_business" | "youtube";
  name: string;
  iconBg: string;
  badgeColor: string;
  description: string;
  features: string[];
  docUrl: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "google_business",
    name: "Google Business Profile",
    iconBg: "bg-emerald-500 text-white",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Publish daily store photos, product showcases, and SEO local posts to rank higher in Google Local 3-Pack.",
    features: ["Daily SEO photo automation", "Customer review monitoring", "Call-To-Action (CTA) post buttons"],
    docUrl: "https://support.google.com/business",
  },
  {
    id: "youtube",
    name: "YouTube Channel",
    iconBg: "bg-rose-600 text-white",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Upload and schedule high-definition videos, YouTube Shorts, custom thumbnails, and SEO tags.",
    features: ["Scheduled video releases", "Vertical Shorts auto-tagging", "Custom thumbnail upload"],
    docUrl: "https://developers.google.com/youtube/v3",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    iconBg: "bg-slate-900 text-white",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    description: "Schedule tweets, threads, product announcements, and media drops using the official X API v2.",
    features: ["Thread publishing", "280-char live validation", "Scheduled media posts"],
    docUrl: "https://developer.x.com",
  },
  {
    id: "instagram",
    name: "Instagram Business",
    iconBg: "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Publish photo carousels, reels, and stories with automated hashtag optimization.",
    features: ["Carousel posts", "Reels scheduling", "First comment hashtag engine"],
    docUrl: "https://developers.facebook.com/docs/instagram-api",
  },
  {
    id: "facebook",
    name: "Facebook Page",
    iconBg: "bg-blue-600 text-white",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Manage brand updates, promotional banners, community announcements, and paid ad boosting.",
    features: ["Page wall posts", "Organic reach tracking", "Paid campaign sync"],
    docUrl: "https://developers.facebook.com",
  },
];

export function SocialChannelsIntegrations() {
  const { hasPermission } = useRbac();
  const canManage = hasPermission("manage:social_media_connections") || hasPermission("manage:crm");

  const [accounts, setAccounts] = useState<SocialAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformDef | null>(null);

  // Form states
  const [accountName, setAccountName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await socialMediaApi.getAccounts();
      setAccounts(data || []);
    } catch (err: any) {
      console.warn("Could not load social accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenConnect = (platform: PlatformDef) => {
    setConnectingPlatform(platform);
    const existing = accounts.find((a) => a.platform === platform.id);
    if (existing) {
      setAccountName(existing.account_name);
      setAccountId(existing.account_id);
    } else {
      setAccountName(
        platform.id === "google_business"
          ? "IoTRONCS Storefront"
          : platform.id === "youtube"
          ? "IoTRONCS Official Channel"
          : platform.id === "twitter"
          ? "@IoTRONCS_AI"
          : "IoTRONCS Official"
      );
      setAccountId(
        platform.id === "google_business"
          ? "locations/948271049"
          : platform.id === "youtube"
          ? "UC_IoTRONCS_TechChannel"
          : platform.id === "twitter"
          ? "IoTRONCS_AI"
          : "page_88492048"
      );
    }
    setApiKey("");
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingPlatform) return;
    try {
      setIsSubmitting(true);
      await socialMediaApi.connectAccount({
        platform: connectingPlatform.id,
        account_name: accountName.trim(),
        account_id: accountId.trim(),
        access_token: apiKey ? apiKey.trim() : `token_${Date.now()}`,
        scopes: ["publish_content", "read_insights", "manage_media"],
        settings: { connected_at: new Date().toISOString() },
      });
      toast.success(`Successfully connected ${connectingPlatform.name}!`);
      setConnectingPlatform(null);
      await fetchAccounts();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save channel connection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async (accId: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}? Scheduled posts for this channel may be paused.`)) return;
    try {
      await socialMediaApi.disconnectAccount(accId);
      toast.success(`Disconnected ${name}`);
      await fetchAccounts();
    } catch (err: any) {
      toast.error("Failed to disconnect channel");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-fuchsia-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-fuchsia-300 text-xs font-semibold backdrop-blur-md">
            <Share2 className="size-3.5" />
            <span>Multi-Channel Social Hub</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Connected Channels & Automated APIs</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Connect your brand channels to enable one-click cross-posting, daily Google SEO photo uploading, and YouTube video scheduling.
          </p>
        </div>
      </div>

      {/* Grid of Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PLATFORMS.map((platform) => {
          const connectedAcc = accounts.find((a) => a.platform === platform.id);
          const isConnected = !!connectedAcc;

          return (
            <div
              key={platform.id}
              className={`rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                isConnected ? "border-emerald-200 ring-1 ring-emerald-500/10" : "border-slate-200"
              }`}
            >
              <div className="space-y-4">
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs ${platform.iconBg}`}>
                      {platform.id === "google_business" ? (
                        <Globe className="size-6" />
                      ) : platform.id === "youtube" ? (
                        <Video className="size-6" />
                      ) : platform.id === "twitter" ? (
                        <span className="font-black text-xl">𝕏</span>
                      ) : (
                        <Share2 className="size-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{platform.name}</h3>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${
                        isConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {isConnected ? (
                          <>
                            <CheckCircle2 className="size-3 text-emerald-600" /> Connected
                          </>
                        ) : (
                          "Ready to Connect"
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Account Details if connected */}
                {isConnected && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{connectedAcc.account_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">ID: {connectedAcc.account_id}</p>
                  </div>
                )}

                <p className="text-xs text-slate-600 leading-relaxed">{platform.description}</p>

                {/* Features list */}
                <ul className="space-y-1 pt-1">
                  {platform.features.map((feat, i) => (
                    <li key={i} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-fuchsia-500 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 border-t border-slate-100 flex items-center gap-2 mt-4">
                {isConnected ? (
                  <>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => handleOpenConnect(platform)}
                      className="flex-1 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    >
                      Configure / Reconnect
                    </button>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => handleDisconnect(connectedAcc.id, platform.name)}
                      title="Disconnect"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => handleOpenConnect(platform)}
                    className="w-full px-4 py-2.5 bg-slate-900 text-white hover:bg-fuchsia-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    Connect {platform.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Modal */}
      {connectingPlatform && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className={`size-8 rounded-lg flex items-center justify-center text-xs font-bold ${connectingPlatform.iconBg}`}>
                  {connectingPlatform.id === "twitter" ? "𝕏" : <Share2 className="size-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Connect {connectingPlatform.name}</h3>
                  <p className="text-[11px] text-slate-500">Enter channel credentials or API key</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConnectingPlatform(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConnection} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account / Channel Name *
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. IoTRONCS Official"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {connectingPlatform.id === "google_business"
                    ? "Location ID / Resource Name *"
                    : connectingPlatform.id === "youtube"
                    ? "YouTube Channel ID *"
                    : connectingPlatform.id === "twitter"
                    ? "X Handle (e.g. @YourBrand) *"
                    : "Page / Account ID *"}
                </label>
                <input
                  type="text"
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. UC_xxxx or @handle or locations/123"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  API Key / OAuth Bearer Token (Optional for demo)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-fuchsia-500/20 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Can be refreshed automatically via OAuth 2.0 web flow in production.
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConnectingPlatform(null)}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Save & Authenticate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
