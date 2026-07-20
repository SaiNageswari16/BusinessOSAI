import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Image as ImageIcon, Send, FileText, CheckCircle, AlertCircle, Copy, Upload, ArrowRight, BrainCircuit, Facebook, X, RefreshCw, Unlink, ExternalLink, ChevronRight, AlertTriangle, Shield } from "lucide-react";
import { crmCampaignsApi, crmLeadsApi } from "@/lib/api-client";
import { toast } from "sonner";

export function AdGenerator() {
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  
  // ── Facebook Connection States ──────────────────────────────────────────────
  type FbStatus = {
    app_configured: boolean;
    page_connected: boolean;
    page_name?: string;
    page_id?: string;
  };
  const [fbStatus, setFbStatus] = useState<FbStatus>({ app_configured: false, page_connected: false });
  const [showFbPanel, setShowFbPanel] = useState(false);
  const [fbPages, setFbPages] = useState<{ id: string; name: string; category: string }[]>([]);
  // Steps: idle | pasting (token input) | verifying | picking | saving | authorizing (OAuth popup)
  const [fbStep, setFbStep] = useState<"idle" | "pasting" | "verifying" | "picking" | "saving" | "authorizing">("idle");
  const [pastedToken, setPastedToken] = useState("");
  const [pastedPageId, setPastedPageId] = useState("");

  const resetFbPanel = () => {
    setFbStep("idle");
    setFbPages([]);
    setPastedToken("");
    setPastedPageId("");
  };

  const refreshFbStatus = useCallback(async () => {
    try {
      const res = await crmLeadsApi.getFbStatus();
      setFbStatus(res);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void refreshFbStatus(); }, [refreshFbStatus]);

  // ── Token Expiry Health State ──────────────────────────────────────────────
  type TokenInfo = {
    is_valid: boolean;
    expires_at?: number | null;
    token_type?: string;
    error?: string | null;
  };
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  useEffect(() => {
    if (!fbStatus.page_connected) return;
    crmLeadsApi.getFbTokenInfo()
      .then(info => setTokenInfo(info))
      .catch(() => {/* silent */});
  }, [fbStatus.page_connected]);

  // Helper: days until token expiry
  const daysUntilExpiry = (): number | null => {
    if (!tokenInfo?.expires_at) return null;
    const now = Math.floor(Date.now() / 1000);
    return Math.ceil((tokenInfo.expires_at - now) / 86400);
  };

  const tokenDays = daysUntilExpiry();
  const tokenExpired = tokenInfo && (!tokenInfo.is_valid || (tokenDays !== null && tokenDays <= 0));
  const tokenWarning = !tokenExpired && tokenDays !== null && tokenDays <= 7;

  // Listen for OAuth popup completion (postMessage from callback page)
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

  /** NEW Direct connection: paste Token AND Page ID directly */
  const handleDirectConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedToken.trim()) {
      toast.error("Access Token is required.");
      return;
    }
    setFbStep("saving");
    try {
      const res = await crmLeadsApi.connectFbDirect({
        page_id: pastedPageId.trim() || undefined,
        access_token: pastedToken.trim()
      });
      await refreshFbStatus();
      resetFbPanel();
      setShowFbPanel(false);
      toast.success(`✅ Connected "${res.page_name}" successfully for your organization!`);
    } catch (err: any) {
      toast.error(err?.detail || "Failed to validate credentials. Please check the ID and Token.");
      setFbStep("pasting");
    }
  };

  /** PRIMARY: Verify pasted token from Meta dashboard — no login needed */
  const handleVerifyToken = async () => {
    if (!pastedToken.trim()) return;
    setFbStep("verifying");
    try {
      const res = await crmLeadsApi.verifyFbToken(pastedToken.trim());
      setFbPages(res.pages);
      setFbStep("picking");
      if (res.count === 1) {
        // Auto-select if only one page
        await handleSelectPage(res.pages[0]);
      }
    } catch (err: any) {
      toast.error(err?.detail || "Invalid or expired token. Make sure it has pages_manage_posts permission.");
      setFbStep("pasting");
    }
  };

  /** SECONDARY: OAuth popup flow (requires App ID + Secret in .env) */
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
      toast.error(err?.detail || "Failed to start OAuth. Make sure FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are set in .env");
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
      toast.success(`✅ "${page.name}" connected! You can now publish ads to this page.`);
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

  // ── Tenant-Level Meta App Config States & Handlers ──────────────────────────
  const [fbAppForm, setFbAppForm] = useState({
    app_id: "",
    app_secret: "",
    redirect_uri: "http://localhost:8000/api/v1/crm/facebook/oauth-callback"
  });

  const loadFbAppConfig = async () => {
    try {
      const config = await crmLeadsApi.getFbAppConfig();
      setFbAppForm({
        app_id: config.app_id || "",
        app_secret: "", // Secret is never returned from API for security
        redirect_uri: config.redirect_uri || "http://localhost:8000/api/v1/crm/facebook/oauth-callback"
      });
    } catch { /* silent */ }
  };

  const handleSaveAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbAppForm.app_id || !fbAppForm.app_secret) {
      toast.error("Please fill in both App ID and App Secret.");
      return;
    }
    setFbStep("saving");
    try {
      await crmLeadsApi.saveFbAppConfig({
        app_id: fbAppForm.app_id.trim(),
        app_secret: fbAppForm.app_secret.trim(),
        redirect_uri: fbAppForm.redirect_uri.trim()
      });
      await refreshFbStatus();
      toast.success("Meta App configuration saved for your organization!");
      setFbStep("idle");
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save configuration.");
      setFbStep("idle");
    }
  };

  const handleDeleteAppConfig = async () => {
    if (!confirm("Are you sure you want to remove your Meta App credentials? This will disable OAuth login for all your organization users.")) return;
    try {
      await crmLeadsApi.deleteFbAppConfig();
      await refreshFbStatus();
      setFbAppForm({ app_id: "", app_secret: "", redirect_uri: "http://localhost:8000/api/v1/crm/facebook/oauth-callback" });
      toast.success("Meta App credentials removed.");
      setFbStep("idle");
    } catch {
      toast.error("Failed to delete credentials.");
    }
  };


  
  const [posterPrompt, setPosterPrompt] = useState("");
  const [style, setStyle] = useState("Photorealistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageUrl, setImageUrl] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [generatingPoster, setGeneratingPoster] = useState(false);

  // Multimodal asset upload state
  const [refImageBase64, setRefImageBase64] = useState<string>("");
  const [refImageName, setRefImageName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [captionPrompt, setCaptionPrompt] = useState("");
  const [caption, setCaption] = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [postId, setPostId] = useState("");

  // Handle file reader
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefImageName(file.name);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setRefImageBase64(reader.result as string);
      toast.success(`Reference asset loaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posterPrompt) return;
    setGeneratingPoster(true);
    setImageUrl("");
    setEnhancedPrompt("");
    setPostId("");
    try {
      const res = await crmCampaignsApi.generatePoster({ 
        prompt: posterPrompt, 
        style,
        aspect_ratio: aspectRatio,
        provider
      });
      setImageUrl(res.image_url);
      setEnhancedPrompt(res.enhanced_prompt);
      toast.success("AI Poster designed successfully!");
      // Pre-fill caption prompt with expanded context
      setCaptionPrompt(`Write a highly engaging Facebook post containing hashtags and search tags about: ${posterPrompt}`);
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to generate ad poster");
    } finally {
      setGeneratingPoster(false);
    }
  };

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
        reference_image: refImageBase64 || undefined
      });
      setCaption(res.copy);
      toast.success("AI social copy designed with tags!");
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to generate caption copy");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handlePublish = async () => {
    if (!imageUrl) return;
    setPublishing(true);
    setPostId("");
    try {
      const res = await crmCampaignsApi.publishFacebook({
        image_url: imageUrl,
        caption: caption || `Check out our new launch! ${posterPrompt}`
      });
      if (res.status === "success") {
        setPostId(res.post_id || "Published");
        toast.success(res.message);
      }
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to publish post. Please check Facebook credentials.");
    } finally {
      setPublishing(false);
    }
  };

  const removeReferenceAsset = () => {
    setRefImageBase64("");
    setRefImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6 min-h-[calc(100vh-6rem)] flex flex-col space-y-6 bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Multimodal Ad Campaigner</h1>
          <p className="text-sm text-muted-foreground">Synthesize design assets, draft high-performing copy, and publish campaigns directly to social media.</p>
        </div>
        
        {/* Header Actions */}
        <div className="flex items-center gap-3 self-end flex-wrap">
          {/* Facebook Connection Status Button */}
          <button
            onClick={() => setShowFbPanel(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer h-9 ${
              fbStatus.page_connected
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                : "bg-muted border-border hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <Facebook className="size-3.5 text-blue-600" />
            {fbStatus.page_connected ? `FB: ${fbStatus.page_name || "Connected"}` : "Connect FB Page"}
          </button>

          {/* Token Expiry Warning Chip — shown only when connected */}
          {fbStatus.page_connected && tokenInfo && (
            <>
              {tokenExpired ? (
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 hover:bg-red-500/15 transition-colors h-9 cursor-pointer"
                  title="Token expired — click to refresh in Meta Explorer"
                >
                  <AlertCircle className="size-3.5" />
                  Token Expired — Refresh
                </a>
              ) : tokenWarning ? (
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 transition-colors h-9 cursor-pointer"
                  title={`Token expires in ${tokenDays} day${tokenDays === 1 ? "" : "s"}`}
                >
                  <AlertTriangle className="size-3.5" />
                  Expires in {tokenDays}d
                </a>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-background border border-border text-muted-foreground h-9"
                  title={tokenInfo.token_type === "page" ? "Page Token (never expires)" : "Token valid"}
                >
                  <Shield className="size-3.5 text-emerald-500" />
                  {tokenInfo.token_type === "page" ? "Non-expiring" : "Token OK"}
                </div>
              )}
            </>
          )}

          {/* Model Switcher Tabs */}
          <div className="flex bg-muted p-1 rounded-xl border border-border w-fit h-9 items-center">
            <button
              onClick={() => setProvider("gemini")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border-none cursor-pointer ${
                provider === "gemini" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground bg-transparent"
              }`}
            >
              <Sparkles className="size-3.5" /> Gemini Imagen 3
            </button>
            <button
              onClick={() => setProvider("openai")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border-none cursor-pointer ${
                provider === "openai" 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground bg-transparent"
              }`}
            >
              <BrainCircuit className="size-3.5" /> OpenAI DALL-E 3
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Controls */}
        <div className="space-y-6">
          {/* Step 1: Design Poster */}
          <div className="glass-panel p-6 rounded-xl border border-border/50 bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">1</span>
              Design AI Creative
            </h2>

            <form onSubmit={handleGeneratePoster} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Design Prompt</label>
                <textarea
                  required
                  rows={3}
                  value={posterPrompt}
                  onChange={(e) => setPosterPrompt(e.target.value)}
                  placeholder="e.g., Promotional poster for a new summer collection, minimalist background, neon glow accent, high realism."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Aesthetic Style</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="Photorealistic">Photorealistic</option>
                    <option value="Modern Ad">Modern Ad Graphic</option>
                    <option value="Minimalist Studio">Minimalist Studio</option>
                    <option value="Cyberpunk Neon">Cyberpunk Neon</option>
                    <option value="Pop Art / Sketch">Pop Art Sketch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="1:1">1:1 (Post Square)</option>
                    <option value="9:16">9:16 (Story / Reel)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <button
                    type="submit"
                    disabled={generatingPoster || !posterPrompt}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors border-none cursor-pointer"
                  >
                    {generatingPoster ? (
                      <><Loader2 className="size-4 animate-spin" /> Synthesizing...</>
                    ) : (
                      <><Sparkles className="size-4" /> Synthesize Creative</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Multimodal Asset Uploader */}
          <div className="glass-panel p-6 rounded-xl border border-border/50 bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">2</span>
              Multimodal Reference Upload
            </h2>

            <div className="space-y-3">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/60 rounded-xl p-5 text-center hover:bg-muted/40 transition-colors cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <Upload className="size-6 text-muted-foreground opacity-60" />
                <p className="text-xs font-semibold">Click to upload brand asset / reference photo</p>
                <p className="text-[10px] text-muted-foreground">Supported types: JPG, PNG (Max 4MB)</p>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {refImageBase64 && (
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-8 rounded overflow-hidden border bg-background shrink-0">
                      <img src={refImageBase64} alt="Asset Thumbnail" className="object-cover w-full h-full" />
                    </div>
                    <span className="truncate font-semibold text-foreground">{refImageName}</span>
                  </div>
                  <button 
                    onClick={removeReferenceAsset}
                    className="text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Copy Generator */}
          <div className="glass-panel p-6 rounded-xl border border-border/50 bg-card space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">3</span>
              Generate Copy & Keywords
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Copywriter Context</label>
                <textarea
                  rows={2}
                  value={captionPrompt}
                  onChange={(e) => setCaptionPrompt(e.target.value)}
                  placeholder="Optional context. Prompt design above will automatically brief the copywriter."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleGenerateCaption}
                disabled={generatingCaption || (!posterPrompt && !captionPrompt)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border hover:bg-accent text-foreground rounded-lg text-sm font-medium disabled:opacity-60 transition-colors cursor-pointer"
              >
                {generatingCaption ? (
                  <><Loader2 className="size-4 animate-spin" /> Drafting Ad Copy...</>
                ) : (
                  <><FileText className="size-4" /> Draft Caption & Keywords</>
                )}
              </button>

              {caption && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-2.5 relative group">
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{caption}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(caption);
                      toast.success("Caption copied!");
                    }}
                    className="absolute right-2 top-2 p-1.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-md border"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side Canvas Preview */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 bg-card flex flex-col items-center justify-center min-h-[500px] space-y-6 text-center">
          {imageUrl ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full flex flex-col items-center space-y-4"
            >
              {/* Image preview */}
              <div className={`relative rounded-2xl overflow-hidden border max-w-sm bg-muted flex items-center justify-center shadow-lg group ${aspectRatio === "1:1" ? "aspect-square w-full" : "aspect-[9/16] h-[480px]"}`}>
                <img src={imageUrl} alt="AI Poster" className="object-cover w-full h-full" />
              </div>

              {/* Enhanced Prompt feedback */}
              {enhancedPrompt && (
                <div className="text-left w-full max-w-sm rounded-lg border bg-muted/30 p-3 space-y-1">
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-1">
                    <BrainCircuit className="size-3" /> Enhanced Creative Brief
                  </p>
                  <p className="text-[11px] text-muted-foreground italic leading-normal">
                    "{enhancedPrompt}"
                  </p>
                </div>
              )}

              {/* Publish Info */}
              <div className="max-w-sm w-full border border-indigo-200 dark:border-indigo-800/40 rounded-xl bg-indigo-50/20 p-4 space-y-3">
                <p className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5 justify-center">
                  <Send className="size-3.5" /> Live Social Feed Publisher
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Ready to post to your linked Facebook Page. Works with raw local image buffers.
                </p>

                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors border-none cursor-pointer"
                >
                  {publishing ? (
                    <><Loader2 className="size-4 animate-spin" /> Publishing Post...</>
                  ) : (
                    <>Publish Live to Social Feed</>
                  )}
                </button>
              </div>

              {/* Published Confirmation */}
              <AnimatePresence>
                {postId && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold"
                  >
                    <CheckCircle className="size-4" /> Live Ad published successfully! ID: {postId}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center space-y-3">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-2">
                <ImageIcon className="size-8 opacity-45" />
              </div>
              <p className="font-semibold text-foreground text-sm">Design Preview Canvas</p>
              <p className="text-xs max-w-xs leading-normal">
                Input your creative prompt on the left, load reference photos, and select between Gemini Imagen or DALL-E to generate your marketing ad.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Facebook Integration Panel */}
      <AnimatePresence>
        {showFbPanel && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-border flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <Facebook className="size-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">Meta Application Integration</h3>
                    <p className="text-[10px] text-muted-foreground">Configure Facebook Pages & Lead Forms for your Organization</p>
                  </div>
                </div>
                <button onClick={() => { setShowFbPanel(false); resetFbPanel(); }} className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer">
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">

                {/* ── Connected Status ── */}
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
                    <button
                      onClick={handleDisconnectFb}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold border-none cursor-pointer transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                )}

                {/* ── Direct connection form ── */}
                {fbStep === "saving" ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Loader2 className="size-8 animate-spin text-indigo-600" />
                    <p className="text-sm font-semibold text-foreground">Verifying Meta configuration…</p>
                  </div>
                ) : (
                  <form onSubmit={handleDirectConnect} className="space-y-4">
                    {/* Setup Instruction Helper */}
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2 text-xs">
                      <p className="font-bold text-foreground">How to fetch credentials from Meta:</p>
                      <ol className="text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed text-[11px]">
                        <li>Go to <strong>developers.facebook.com/tools/explorer</strong></li>
                        <li>Under <strong>User or Page</strong> dropdown, choose your Facebook Page</li>
                        <li>Ensure <strong>pages_manage_posts</strong> and <strong>pages_manage_ads</strong> permissions are selected</li>
                        <li>Click <strong>Generate Access Token</strong> and copy the token</li>
                        <li>Copy your <strong>Facebook Page ID</strong> (from Page Settings or About page)</li>
                      </ol>
                      <a
                        href="https://developers.facebook.com/tools/explorer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        <ExternalLink className="size-3" /> Meta Graph API Explorer
                      </a>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                        <span>Facebook Page ID <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span></span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 10294857201948 (Auto-resolved if left empty)"
                        value={pastedPageId}
                        onChange={(e) => setPastedPageId(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">If left blank, the system automatically fetches your Page ID and Name from the token.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Facebook Page Access Token <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="EAAxxxxxxxxxxxxxxxxxxxx..."
                        value={pastedToken}
                        onChange={(e) => setPastedToken(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFbPanel(false)}
                        className="flex-1 px-4 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted transition-colors bg-transparent cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer transition-colors"
                      >
                        Connect & Save Settings
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
