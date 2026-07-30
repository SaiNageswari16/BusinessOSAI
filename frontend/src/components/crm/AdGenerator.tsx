import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Image as ImageIcon, Send, FileText, CheckCircle,
  AlertCircle, Copy, Upload, ArrowRight, BrainCircuit, Facebook, X,
  RefreshCw, Unlink, ExternalLink, ChevronRight, AlertTriangle, Shield,
  ThumbsUp, ThumbsDown, Megaphone, Layers, TrendingUp
} from "lucide-react";
import { crmCampaignsApi, crmLeadsApi, paidAdsApi, assetLibraryApi } from "@/lib/api-client";
import PaidCampaignBuilder from "./PaidCampaignBuilder";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type FbStatus = {
  app_configured: boolean;
  page_connected: boolean;
  page_name?: string;
  page_id?: string;
};

type TokenInfo = {
  is_valid: boolean;
  expires_at?: number | null;
  token_type?: string;
  error?: string | null;
};

type PipelineStatus = "idle" | "generating" | "review" | "approved" | "rejected" | "saving" | "published";

// ── Pipeline Component ─────────────────────────────────────────────────────────

export function AdGenerator() {
  const [provider, setProvider] = useState<"gemini" | "openai" | "claude">("gemini");

  // Facebook connection
  const [fbStatus, setFbStatus] = useState<FbStatus>({ app_configured: false, page_connected: false });
  const [showFbPanel, setShowFbPanel] = useState(false);
  const [fbPages, setFbPages] = useState<{ id: string; name: string; category: string }[]>([]);
  const [fbStep, setFbStep] = useState<"idle" | "pasting" | "verifying" | "picking" | "saving" | "authorizing">("idle");
  const [pastedToken, setPastedToken] = useState("");
  const [pastedPageId, setPastedPageId] = useState("");

  const resetFbPanel = () => {
    setFbStep("idle");
    setFbPages([]);
    setPastedToken("");
    setPastedPageId("");
  };

  const refreshFbStatus = async () => {
    try {
      const res = await crmLeadsApi.getFbStatus();
      setFbStatus(res);
    } catch { /* silent */ }
  };

  useEffect(() => { void refreshFbStatus(); }, []);

  // Token health
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  useEffect(() => {
    if (!fbStatus.page_connected) return;
    crmLeadsApi.getFbTokenInfo()
      .then(info => setTokenInfo(info))
      .catch(() => {/* silent */});
  }, [fbStatus.page_connected]);

  const daysUntilExpiry = (): number | null => {
    if (!tokenInfo?.expires_at) return null;
    return Math.ceil((tokenInfo.expires_at - Math.floor(Date.now() / 1000)) / 86400);
  };
  const tokenDays = daysUntilExpiry();
  const tokenExpired = tokenInfo && (!tokenInfo.is_valid || (tokenDays !== null && tokenDays <= 0));
  const tokenWarning = !tokenExpired && tokenDays !== null && tokenDays <= 7;

  // OAuth popup
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type === "FB_OAUTH_SUCCESS") {
        setFbStep("picking");
        try {
          const res = await crmLeadsApi.getFbAvailablePages();
          setFbPages(res.pages);
        } catch {
          toast.error("Failed to load your Facebook Pages. Please try again.");
          setFbStep("idle");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleDirectConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedToken.trim()) { toast.error("Access Token is required."); return; }
    setFbStep("saving");
    try {
      const res = await crmLeadsApi.connectFbDirect({ page_id: pastedPageId.trim() || undefined, access_token: pastedToken.trim() });
      await refreshFbStatus();
      resetFbPanel();
      setShowFbPanel(false);
      toast.success(`✅ Connected "${res.page_name}" successfully!`);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to validate credentials.");
      setFbStep("pasting");
    }
  };

  const handleVerifyToken = async () => {
    if (!pastedToken.trim()) return;
    setFbStep("verifying");
    try {
      const res = await crmLeadsApi.verifyFbToken(pastedToken.trim());
      setFbPages(res.pages);
      setFbStep("picking");
      if (res.count === 1) await handleSelectPage(res.pages[0]);
    } catch (err: any) {
      toast.error(err?.detail || "Invalid or expired token.");
      setFbStep("pasting");
    }
  };

  const handleOAuthConnect = async () => {
    setFbStep("authorizing");
    try {
      const { auth_url } = await crmLeadsApi.getFbAuthUrl();
      const w = 560, h = 620;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      const popup = window.open(auth_url, "fb_oauth", `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`);
      if (!popup) window.location.href = auth_url;
    } catch (err: any) {
      toast.error(err?.detail || "Failed to start OAuth.");
      setFbStep("idle");
    }
  };

  const handleSelectPage = async (page: { id: string; name: string; category: string }) => {
    setFbStep("saving");
    try {
      await crmLeadsApi.selectFbPage({ page_id: page.id, page_name: page.name, page_access_token: "" });
      await refreshFbStatus();
      resetFbPanel();
      setShowFbPanel(false);
      toast.success(`✅ "${page.name}" connected!`);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to select page");
      setFbStep("picking");
    }
  };

  const handleDisconnectFb = async () => {
    try {
      await crmLeadsApi.disconnectFbPage();
      setFbStatus({ app_configured: fbStatus.app_configured, page_connected: false });
      resetFbPanel();
      toast.success("Facebook page disconnected.");
    } catch {
      toast.error("Failed to disconnect.");
    }
  };

  // App config
  const [fbAppForm, setFbAppForm] = useState({ app_id: "", app_secret: "", redirect_uri: "http://localhost:8000/api/v1/crm/facebook/oauth-callback" });
  const loadFbAppConfig = async () => {
    try {
      const config = await crmLeadsApi.getFbAppConfig();
      setFbAppForm({
        app_id: config.app_id || "",
        app_secret: "",
        redirect_uri: config.redirect_uri || "http://localhost:8000/api/v1/crm/facebook/oauth-callback",
      });
    } catch { /* silent */ }
  };

  const handleSaveAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbAppForm.app_id || !fbAppForm.app_secret) { toast.error("Please fill both App ID and App Secret."); return; }
    setFbStep("saving");
    try {
      await crmLeadsApi.saveFbAppConfig({ app_id: fbAppForm.app_id.trim(), app_secret: fbAppForm.app_secret.trim(), redirect_uri: fbAppForm.redirect_uri.trim() });
      await refreshFbStatus();
      toast.success("Meta App configuration saved!");
      setFbStep("idle");
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save configuration.");
      setFbStep("idle");
    }
  };

  const handleDeleteAppConfig = async () => {
    if (!confirm("Remove your Meta App credentials? This will disable OAuth login.")) return;
    try {
      await crmLeadsApi.deleteFbAppConfig();
      await refreshFbStatus();
      setFbAppForm({ app_id: "", app_secret: "", redirect_uri: "http://localhost:8000/api/v1/crm/facebook/oauth-callback" });
      toast.success("Meta App credentials removed.");
    } catch { toast.error("Failed to delete credentials."); }
  };

  useEffect(() => { void loadFbAppConfig(); }, []);

  // ── AI Pipeline State ────────────────────────────────────────────────────────

  const [posterPrompt, setPosterPrompt] = useState("");
  const [style, setStyle] = useState("Photorealistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageUrl, setImageUrl] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [generatingPoster, setGeneratingPoster] = useState(false);

  // Multimodal asset upload
  const [refImageBase64, setRefImageBase64] = useState("");
  const [refImageName, setRefImageName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Caption
  const [captionPrompt, setCaptionPrompt] = useState("");
  const [caption, setCaption] = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);

  // Pipeline flow
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [publishing, setPublishing] = useState(false);
  const [postId, setPostId] = useState("");
  const [savedAssetId, setSavedAssetId] = useState<string | null>(null);

  // Paid campaign builder state
  const [showPaidBuilder, setShowPaidBuilder] = useState(false);
  const [paidBuilderData, setPaidBuilderData] = useState<{ imageUrl: string; caption: string } | null>(null);

  // Asset library modal
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [assetLibrary, setAssetLibrary] = useState<assetLibraryApi.AssetLibraryItem[]>([]);
  const [assetFilter, setAssetFilter] = useState<"all" | "approved" | "unused">("approved");

  const reuseAsset = (asset: assetLibraryApi.AssetLibraryItem) => {
    setImageUrl(asset.public_url);
    setEnhancedPrompt(asset.enhanced_prompt || asset.original_prompt || "");
    if (asset.original_prompt && asset.original_prompt !== posterPrompt) {
      setPosterPrompt(asset.original_prompt);
    }
    if (asset.aspect_ratio) setAspectRatio(asset.aspect_ratio as "1:1" | "9:16");
    if (asset.style) setStyle(asset.style as any);
    setPostId("");
    setSavedAssetId(asset.id);
    setPipelineStatus("approved");
    setShowAssetLibrary(false);
    toast.success(`Loaded "${asset.filename}". You can now republish or relaunch.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefImageName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setRefImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── STEP 1: Generate Image ───────────────────────────────────────────────────

  const handleGeneratePoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posterPrompt.trim()) return;
    setGeneratingPoster(true);
    setImageUrl("");
    setEnhancedPrompt("");
    setPostId("");
    setSavedAssetId(null);
    setPipelineStatus("generating");
    try {
      const res = await crmCampaignsApi.generatePoster({
        prompt: posterPrompt,
        style,
        aspect_ratio: aspectRatio,
        provider,
      });
      setImageUrl(res.image_url);
      setEnhancedPrompt(res.enhanced_prompt);
      setPipelineStatus("review");
      setCaptionPrompt(`Write a highly engaging Facebook post with hashtags and search tags about: ${posterPrompt}`);
      toast.success("Image generated! Review below.");
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to generate ad poster");
      setPipelineStatus("idle");
    } finally {
      setGeneratingPoster(false);
    }
  };

  // ── STEP 2: Generate Caption ────────────────────────────────────────────────

  const handleGenerateCaption = async (e: React.MouseEvent) => {
    e.preventDefault();
    const promptText = captionPrompt || `Post for: ${posterPrompt}`;
    if (!promptText) return;
    setGeneratingCaption(true);
    setCaption("");
    try {
      const res = await crmCampaignsApi.generateCopy({
        prompt: promptText,
        channel: "Facebook Feed",
        provider,
        reference_image: refImageBase64 || undefined,
      });
      setCaption(res.copy);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to generate caption");
    } finally {
      setGeneratingCaption(false);
    }
  };

  // ── STEP 3: Approval Actions ────────────────────────────────────────────────

  const handleApprove = () => {
    setPipelineStatus("approved");
    toast.success("Image approved! Choose your next action below.");
  };

  const handleReject = () => {
    setPipelineStatus("rejected");
    setImageUrl("");
    setEnhancedPrompt("");
    setCaption("");
    toast.info("Image rejected. Generate a new one.");
  };

  // ── STEP 4a: Save to Asset Library ─────────────────────────────────────────

  const handleSaveToLibrary = async () => {
    if (!imageUrl) return;
    setPipelineStatus("saving");
    try {
      const res = await assetLibraryApi.save({
        filename: `poster_${Date.now()}.jpg`,
        public_url: imageUrl,
        aspect_ratio: aspectRatio,
        source: provider,
        provider_model: provider === "gemini" ? "imagen-3.0-generate-002" : provider === "openai" ? "dall-e-3" : "claude/gemini",
        original_prompt: posterPrompt,
        enhanced_prompt: enhancedPrompt,
        style,
        tags: [posterPrompt.split(" ").slice(0, 5).join(" ").toLowerCase()],
      });
      setSavedAssetId(res.id);
      toast.success("Saved to Asset Library! Reusable in future campaigns.");
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save to library");
    } finally {
      setPipelineStatus("approved"); // back to approved view
    }
  };

  // ── STEP 4b: Publish Organic Post ───────────────────────────────────────────

  const handlePublish = async () => {
    if (!imageUrl) return;
    setPublishing(true);
    setPostId("");
    try {
      const res = await crmCampaignsApi.publishFacebook({
        image_url: imageUrl,
        caption: caption || `Check out our new launch! ${posterPrompt}`,
      });
      if (res.status === "success") {
        setPostId(res.post_id || "Published");
        toast.success("Published to Facebook successfully!");
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to publish post.");
    } finally {
      setPublishing(false);
    }
  };

  // ── STEP 4c: Launch Paid Campaign ──────────────────────────────────────────

  const handleLaunchPaidCampaign = () => {
    if (!imageUrl) {
      toast.error("Generate an image first before launching as a paid ad.");
      return;
    }
    if (!fbStatus.page_connected) {
      toast.error("Connect your Facebook Page first (top-right button).");
      return;
    }
    setPaidBuilderData({ imageUrl, caption: caption || posterPrompt });
    setShowPaidBuilder(true);
  };

  const handlePaidCampaignCreated = (campaignId: string) => {
    setShowPaidBuilder(false);
    setPaidBuilderData(null);
    toast.success("Paid campaign created! View it in Meta Campaigns & Insights.");
  };

  // ── Asset Library ───────────────────────────────────────────────────────────

  const loadAssetLibrary = async (statusFilter: string = "approved") => {
    try {
      const res = await assetLibraryApi.list(statusFilter);
      setAssetLibrary(res.items);
    } catch {
      setAssetLibrary([]);
    }
  };

  useEffect(() => {
    if (showAssetLibrary) {
      const statusMap: Record<string, string> = { all: "", approved: "approved", unused: "approved" };
      loadAssetLibrary(statusMap[assetFilter] || "");
    }
  }, [showAssetLibrary, assetFilter]);

  // ── Pipeline Step Indicator ─────────────────────────────────────────────────

  const steps = [
    { key: "generating" as const, label: "Generate", icon: Sparkles },
    { key: "review" as const, label: "Review", icon: CheckCircle },
    { key: "approved" as const, label: "Publish", icon: Send },
  ];

  const currentStepIdx = pipelineStatus === "idle" ? -1
    : pipelineStatus === "generating" ? 0
    : pipelineStatus === "review" || pipelineStatus === "rejected" ? 1
    : 2;

  return (
    <div className="p-6 min-h-[calc(100vh-6rem)] flex flex-col space-y-6 bg-background">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Ad Pipeline</h1>
          <p className="text-sm text-muted-foreground">Generate → Approve → Publish → Promote. Full Meta workflow.</p>
        </div>
        <div className="flex items-center gap-3 self-end flex-wrap">
          {/* FB Connection */}
          <button
            onClick={() => setShowFbPanel(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer h-9 ${
              fbStatus.page_connected
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                : "bg-muted border-border hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <Facebook className="size-3.5 text-blue-600" />
            {fbStatus.page_connected ? `FB: ${fbStatus.page_name || "Connected"}` : "Connect FB Page"}
          </button>

          {/* Token health */}
          {fbStatus.page_connected && tokenInfo && (
            <>
              {tokenExpired ? (
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-600 hover:bg-red-500/15 transition-colors h-9 cursor-pointer">
                  <AlertCircle className="size-3.5" /> Token Expired — Refresh
                </a>
              ) : tokenWarning ? (
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-600 hover:bg-amber-500/15 transition-colors h-9 cursor-pointer">
                  <AlertTriangle className="size-3.5" /> Expires in {tokenDays}d
                </a>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-background border border-border text-muted-foreground h-9"
                  title={tokenInfo.token_type === "page" ? "Page Token (never expires)" : "Token valid"}>
                  <Shield className="size-3.5 text-emerald-500" />
                  {tokenInfo.token_type === "page" ? "Non-expiring" : "Token OK"}
                </div>
              )}
            </>
          )}

          {/* Model Switcher */}
          <div className="flex bg-muted p-1 rounded-xl border border-border w-fit h-9 items-center">
            <button onClick={() => setProvider("gemini")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                provider === "gemini" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Sparkles className="size-3.5 inline mr-1" />Gemini Imagen
            </button>
            <button onClick={() => setProvider("openai")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                provider === "openai" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <BrainCircuit className="size-3.5 inline mr-1" />DALL-E 3
            </button>
            <button onClick={() => setProvider("claude")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                provider === "claude" ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Megaphone className="size-3.5 inline mr-1" />Claude
            </button>
          </div>

          {/* Asset Library button */}
          <button onClick={() => setShowAssetLibrary(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-muted border border-border hover:bg-muted/80 text-foreground h-9 cursor-pointer transition-colors">
            <Layers className="size-3.5" /> Library
          </button>
        </div>
      </div>

      {/* ── Pipeline Progress Bar ── */}
      {(pipelineStatus !== "idle") && (
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const done = i < currentStepIdx;
            const active = i === currentStepIdx;
            return (
              <React.Fragment key={s.key}>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                  active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                }`}>
                  <s.icon className="size-3" />
                  {s.label}
                </div>
                {i < steps.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── Recently Generated Gallery (disabled temporarily) ── */}
      {false && (
        <></>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── LEFT: Controls ── */}
        <div className="space-y-6">
          {/* Step 1: Generate */}
          <div className="border border-border/50 bg-card rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">1</span>
              Design Creative
            </h2>
            <form onSubmit={handleGeneratePoster} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Design Prompt</label>
                <textarea required rows={3} value={posterPrompt} onChange={(e) => setPosterPrompt(e.target.value)}
                  placeholder="e.g., Promotional poster for a summer collection, minimalist background, neon glow accent, high realism."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Style</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer">
                    <option>Photorealistic</option>
                    <option>Modern Ad Graphic</option>
                    <option>Minimalist Studio</option>
                    <option>Cyberpunk Neon</option>
                    <option>Pop Art Sketch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Aspect Ratio</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer">
                    <option value="1:1">1:1 (Post Square)</option>
                    <option value="9:16">9:16 (Story / Reel)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <button type="submit" disabled={generatingPoster || !posterPrompt}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors border-none cursor-pointer">
                    {generatingPoster ? <><Loader2 className="size-4 animate-spin" /> Synthesizing...</> : <><Sparkles className="size-4" /> Generate Creative ({provider === "claude" ? "Gemini + Claude prompt" : provider})</>}
                  </button>
                  {provider === "claude" && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                      Uses Claude for prompt enhancement → Gemini Imagen for image. No extra cost.
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Step 2: Reference Upload */}
          <div className="border border-border/50 bg-card rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">2</span>
              Reference Asset (Optional)
            </h2>
            <div onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/60 rounded-xl p-5 text-center hover:bg-muted/40 transition-colors cursor-pointer flex flex-col items-center justify-center space-y-2">
              <Upload className="size-6 text-muted-foreground opacity-60" />
              <p className="text-xs font-semibold">Upload brand asset / reference photo</p>
              <p className="text-[10px] text-muted-foreground">JPG, PNG — Max 4MB</p>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
            {refImageBase64 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-8 rounded overflow-hidden border bg-background shrink-0">
                    <img src={refImageBase64} alt="Asset" className="object-cover w-full h-full" />
                  </div>
                  <span className="truncate font-semibold">{refImageName}</span>
                </div>
                <button onClick={() => { setRefImageBase64(""); setRefImageName(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer">Remove</button>
              </div>
            )}
          </div>

          {/* Paid Ads Quick Launch */}
          <div className="border border-primary/30 bg-gradient-to-br from-primary/5 to-indigo-500/5 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">$</span>
              Skip to Paid Ads
            </h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Already have a perfect creative? Launch a paid campaign directly without regenerating.
              Or use your AI-generated image to create a real Meta ad in minutes.
            </p>
            <button onClick={handleLaunchPaidCampaign}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-sm font-bold transition-all cursor-pointer shadow-sm">
              <Megaphone className="size-4" />
              {imageUrl ? "Use This Image for Paid Ad" : "Open Paid Campaign Builder"}
            </button>
            {!imageUrl && !fbStatus.page_connected && (
              <p className="text-[10px] text-amber-600 font-semibold">
                Connect Facebook Page first (top right)
              </p>
            )}
          </div>

          {/* Step 3: Copy Generator */}
          <div className="border border-border/50 bg-card rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">3</span>
              Caption & Keywords
            </h2>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Copywriter Context</label>
              <textarea rows={2} value={captionPrompt} onChange={(e) => setCaptionPrompt(e.target.value)}
                placeholder="Optional context. Auto-filled from your prompt above."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
            </div>
            <button onClick={handleGenerateCaption} disabled={generatingCaption || (!posterPrompt && !captionPrompt)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border hover:bg-accent text-foreground rounded-lg text-sm font-medium disabled:opacity-60 transition-colors cursor-pointer">
              {generatingCaption ? <><Loader2 className="size-4 animate-spin" /> Drafting...</> : <><FileText className="size-4" /> Draft Caption</>}
            </button>
            {caption && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2.5 relative group">
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{caption}</p>
                <button onClick={() => { navigator.clipboard.writeText(caption); toast.success("Caption copied!"); }}
                  className="absolute right-2 top-2 p-1.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-md border cursor-pointer">
                  <Copy className="size-3" />
                </button>
              </div>
            )}
          </div>

          {/* ── Pipeline Actions (shown after approval) ── */}
          <AnimatePresence>
            {pipelineStatus === "approved" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="flex items-center justify-center size-5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">4</span>
                  Publish & Promote
                </h2>

                {/* Action buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={handleSaveToLibrary} disabled={!!savedAssetId}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50">
                    <Layers className="size-4 text-indigo-500" />
                    {savedAssetId ? "✓ Saved to Library" : "Save to Asset Library"}
                  </button>

                  <button onClick={handlePublish} disabled={publishing || !fbStatus.page_connected}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
                    {publishing ? <><Loader2 className="size-4 animate-spin" /> Publishing...</> : <><Send className="size-4" /> Publish to Facebook</>}
                  </button>

                  <button onClick={handleLaunchPaidCampaign} disabled={!fbStatus.page_connected}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-colors cursor-pointer disabled:opacity-50">
                    <Megaphone className="size-4" />
                    Launch as Paid Ad
                  </button>

                  <button onClick={handleReject}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-card hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 text-xs font-semibold transition-colors cursor-pointer">
                    <X className="size-4" />
                    Discard & Regenerate
                  </button>
                </div>

                {postId && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold">
                    <CheckCircle className="size-4" /> Published! Post ID: {postId}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT: Canvas Preview ── */}
        <div className="border border-border/50 bg-card rounded-xl p-6 flex flex-col items-center justify-center min-h-[500px] space-y-4">
          {generatingPoster || pipelineStatus === "generating" ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="size-12 animate-spin text-indigo-500" />
                <Sparkles className="size-5 text-indigo-300 absolute -top-1 -right-2 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground">Synthesizing creative...</p>
                <p className="text-[11px] text-muted-foreground">AI is crafting your {style} image at {aspectRatio}</p>
              </div>
              <div className="w-48 space-y-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-2 bg-muted/60 rounded-full animate-pulse" style={{ width: `${80 - i * 15}%` }} />
                ))}
              </div>
            </div>
          ) : imageUrl ? (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full flex flex-col items-center space-y-4">
              {/* Image */}
              <div className={`relative rounded-2xl overflow-hidden border max-w-sm bg-muted shadow-lg ${aspectRatio === "1:1" ? "aspect-square w-full" : "aspect-[9/16] h-[480px]"}`}>
                <img src={imageUrl} alt="AI Poster" className="object-cover w-full h-full" />
                {/* Status badge */}
                {pipelineStatus === "review" && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow">
                    <AlertTriangle className="size-2.5" /> Pending Approval
                  </div>
                )}
                {pipelineStatus === "approved" && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow">
                    <CheckCircle className="size-2.5" /> Approved
                  </div>
                )}
              </div>

              {/* Enhanced Prompt */}
              {enhancedPrompt && (
                <div className="text-left w-full max-w-sm rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1">
                    <BrainCircuit className="size-3" /> Enhanced Creative Brief
                  </p>
                  <p className="text-[11px] text-muted-foreground italic">"{enhancedPrompt}"</p>
                </div>
              )}

              {/* Approval actions */}
              {pipelineStatus === "review" && (
                <div className="flex items-center gap-3 max-w-sm w-full">
                  <button onClick={handleApprove}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer">
                    <ThumbsUp className="size-4" /> Approve
                  </button>
                  <button onClick={handleReject}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer">
                    <ThumbsDown className="size-4" /> Reject
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center space-y-3">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                <ImageIcon className="size-8 opacity-45" />
              </div>
              <p className="font-semibold text-foreground text-sm">Creative Preview Canvas</p>
              <p className="text-xs max-w-xs text-center leading-relaxed">
                Generate a creative on the left. Your image, caption, and the full Meta pipeline — all in one place.
              </p>
              {pipelineStatus === "rejected" && (
                <p className="text-[11px] text-amber-600 font-semibold">Discarded. Generate a new creative above.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Paid Campaign Builder (inline, shown when launched from pipeline) ── */}
      <AnimatePresence>
        {showPaidBuilder && paidBuilderData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 0 }}
            className="border border-border bg-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Megaphone className="size-4 text-primary" />
                Create Paid Ad Campaign
              </h3>
              <button onClick={() => { setShowPaidBuilder(false); setPaidBuilderData(null); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
              <ImageIcon className="size-4 text-indigo-500" />
              <span>Using image from your generated creative. Edit campaign details below.</span>
            </div>
            <PaidCampaignBuilder
              onCreated={handlePaidCampaignCreated}
              initialImageUrl={paidBuilderData?.imageUrl}
              initialCaption={paidBuilderData?.caption}
              initialCampaignName={posterPrompt ? `${posterPrompt.slice(0, 60)} - Paid Campaign` : "Paid Campaign"}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Asset Library Modal ── */}
      <AnimatePresence>
        {showAssetLibrary && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAssetLibrary(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-border flex justify-between items-center bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                <div>
                  <h3 className="font-bold text-foreground text-sm">Asset Library — Select to Reuse</h3>
                  <p className="text-[10px] text-muted-foreground">{assetLibrary.length} {assetFilter} asset(s) available · click any to load</p>
                </div>
                <button onClick={() => setShowAssetLibrary(false)} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                  <X className="size-4" />
                </button>
              </div>
              {/* Filter tabs */}
              <div className="px-5 pt-3 flex items-center gap-2 border-b border-border">
                {([
                  { key: "approved" as const, label: "Approved", icon: CheckCircle },
                  { key: "all" as const, label: "All Statuses", icon: Layers },
                  { key: "unused" as const, label: "Not Used Yet", icon: Sparkles },
                ]).map((tab) => (
                  <button key={tab.key}
                    onClick={() => setAssetFilter(tab.key)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
                      assetFilter === tab.key
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}>
                    <tab.icon className="size-3" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)]">
                {assetLibrary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Layers className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-bold text-foreground">No saved assets yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Generate and approve an image to save it here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {assetLibrary
                      .filter((a) => assetFilter === "unused" ? !a.used_in_organic_post && !a.used_in_paid_campaign : true)
                      .map((asset) => (
                      <div key={asset.id} className="border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow bg-card">
                        <div className={`${asset.aspect_ratio === "9:16" ? "aspect-[9/16] h-48" : "aspect-square"} bg-muted relative overflow-hidden`}>
                          <img src={asset.public_url} alt={asset.filename} className="object-cover w-full h-full" />
                          <div className={`absolute top-2 right-2 px-1.5 py-0.5 text-white text-[9px] font-bold rounded-full ${
                            asset.approval_status === "approved" ? "bg-emerald-500" :
                            asset.approval_status === "rejected" ? "bg-red-500" : "bg-amber-500"
                          }`}>
                            {asset.approval_status}
                          </div>
                        </div>
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-[10px] font-semibold text-foreground truncate">{asset.filename}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 font-semibold">{asset.source}</span>
                            <span className="text-[9px] text-muted-foreground">{asset.aspect_ratio}</span>
                            {asset.style && <span className="text-[9px] text-muted-foreground">{asset.style}</span>}
                          </div>
                          {asset.original_prompt && (
                            <p className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">{asset.original_prompt}</p>
                          )}
                          <div className="flex items-center gap-1 flex-wrap pt-0.5">
                            {asset.used_in_organic_post && <span className="text-[9px] text-emerald-600 font-semibold">✓ Organic</span>}
                            {asset.used_in_paid_campaign && <span className="text-[9px] text-blue-600 font-semibold">✓ Paid</span>}
                            {!asset.used_in_organic_post && !asset.used_in_paid_campaign && <span className="text-[9px] text-muted-foreground italic">Unused</span>}
                          </div>
                          {/* Reuse button */}
                          <button onClick={() => reuseAsset(asset)}
                            className="w-full mt-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-bold transition-colors cursor-pointer">
                            <RefreshCw className="size-3" />
                            Use This Image
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Facebook Integration Panel ── */}
      <AnimatePresence>
        {showFbPanel && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-border flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <Facebook className="size-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">Meta Integration</h3>
                    <p className="text-[10px] text-muted-foreground">Connect your Facebook Page</p>
                  </div>
                </div>
                <button onClick={() => { setShowFbPanel(false); resetFbPanel(); }} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                {/* Connected Status */}
                {fbStatus.page_connected && fbStep === "idle" && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle className="size-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{fbStatus.page_name}</p>
                        <p className="text-[10px] text-muted-foreground">ID: {fbStatus.page_id} · Connected ✓</p>
                      </div>
                    </div>
                    <button onClick={handleDisconnectFb}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold border-none cursor-pointer transition-colors">
                      Disconnect
                    </button>
                  </div>
                )}

                {fbStep === "saving" ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Loader2 className="size-8 animate-spin text-indigo-600" />
                    <p className="text-sm font-semibold text-foreground">Verifying Meta configuration…</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Direct connection */}
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2 text-xs">
                      <p className="font-bold text-foreground">How to connect:</p>
                      <ol className="text-muted-foreground space-y-1 list-decimal list-inside text-[11px] leading-relaxed">
                        <li>Go to <strong>developers.facebook.com/tools/explorer</strong></li>
                        <li>Choose your Facebook Page and select <strong>pages_manage_posts</strong> + <strong>pages_manage_ads</strong></li>
                        <li>Generate token, paste below with your Page ID</li>
                      </ol>
                    </div>

                    <form onSubmit={handleDirectConnect} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Page ID <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span></label>
                        <input type="text" placeholder="e.g. 10294857201948" value={pastedPageId} onChange={(e) => setPastedPageId(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Access Token <span className="text-red-500">*</span></label>
                        <textarea required rows={3} placeholder="EAAxxxxxxxxxxxxxxxxxxxx..." value={pastedToken} onChange={(e) => setPastedToken(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setShowFbPanel(false); resetFbPanel(); }}
                          className="flex-1 px-4 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted transition-colors bg-transparent cursor-pointer">Cancel</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors">Connect</button>
                      </div>
                    </form>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                      <div className="relative flex justify-center text-[10px]"><span className="px-2 bg-card text-muted-foreground">OR</span></div>
                    </div>

                    <button type="button" onClick={handleOAuthConnect}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors">
                      <ExternalLink className="size-3.5" /> OAuth Login (Meta)
                    </button>

                    {/* App Config */}
                    <details className="border border-border rounded-xl">
                      <summary className="px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground">Meta App Config (Advanced)</summary>
                      <form onSubmit={handleSaveAppConfig} className="p-4 space-y-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">App ID</label>
                          <input type="text" value={fbAppForm.app_id} onChange={(e) => setFbAppForm({...fbAppForm, app_id: e.target.value})}
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">App Secret</label>
                          <input type="password" value={fbAppForm.app_secret} onChange={(e) => setFbAppForm({...fbAppForm, app_secret: e.target.value})}
                            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold border-none cursor-pointer">Save Config</button>
                          <button type="button" onClick={handleDeleteAppConfig}
                            className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold border-none cursor-pointer">Delete</button>
                        </div>
                      </form>
                    </details>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
