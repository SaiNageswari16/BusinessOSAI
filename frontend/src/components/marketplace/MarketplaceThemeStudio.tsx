import React, { useState, useEffect } from "react";
import {
  Palette,
  Check,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Store,
  Eye,
  Sliders,
  Type,
  PhoneCall,
  Mail,
  ShieldCheck,
  Smartphone,
  Laptop,
  Monitor,
  ShoppingBag,
  Zap,
  Sprout,
  Pill,
  Apple,
  Search,
  ShoppingCart,
  Heart,
  Save,
  Info,
  CheckCircle,
  Copy,
  Globe,
  Radio,
  Lock,
  Unlock,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STORE_THEMES, StoreThemeConfig, DEFAULT_THEME_ID } from "@/data/storeThemesConfig";
import {
  getActiveStoreThemeId,
  getActiveStoreBranding,
  saveActiveStoreThemeSettings,
  StoreBrandingConfig,
  useStoreTheme,
} from "@/contexts/StoreThemeContext";
import { marketplaceApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

const SECTOR_ICONS: Record<string, React.ElementType> = {
  nursery_botanics: Sprout,
  pharma_medical: Pill,
  modern_fresh: Apple,
  fashion_boutique: Sparkles,
  mega_market: Laptop,
  speed_mart: Zap,
};

const SECTOR_FEATURES: Record<string, string[]> = {
  nursery_botanics: [
    "🌿 Sunlight & Watering care guidance tags",
    "🪴 Artisanal pot size & ceramic color variants",
    "🛡️ 7-Day transit plant health replacement guarantee",
    "📞 Free Plant Doctor WhatsApp helpline integration",
  ],
  pharma_medical: [
    "💊 Prescription Rx badge & verified pharmacist audit",
    "🔬 Salt composition & generic molecule breakdown",
    "📦 Strip, bottle, and bulk dosage pack selectors",
    "🚚 Temperature-controlled cold chain dispatch badges",
  ],
  modern_fresh: [
    "🛒 Weight & volume selectors (250g, 500g, 1kg)",
    "🥬 Farm-to-table origin & organic harvest certifications",
    "🏷️ Buy 1 Get 1 & promotional discount ribbons",
    "⚡ Freshness preservation sealed packaging guarantee",
  ],
  fashion_boutique: [
    "👗 Haute editorial lookbooks & collection grids",
    "🎨 Interactive color swatch circles with live image switch",
    "📐 Smart size guide & clothing fit recommendation",
    "🛍️ Elegant slide-out bag with luxury checkout flow",
  ],
  mega_market: [
    "⚡ Amazon/BestBuy-style technical specifications table",
    "⭐ Granular customer star ratings & verified reviews",
    "🧭 Left-side category & brand multi-filter rail",
    "🚀 Instant Buy Now 1-click checkout buttons",
  ],
  speed_mart: [
    "🚀 10-Minute instant hyperlocal delivery countdown",
    "➕ Instant [- 1 +] stepper add-to-cart buttons",
    "📱 Mobile-first sticky category pill navigation",
    "🛍️ Floating bottom order bar with instant checkout",
  ],
};

const RESERVED_SLUGS = new Set([
  "api", "admin", "login", "register", "shop", "cart",
  "checkout", "orders", "account", "settings", "store", "public"
]);

export function MarketplaceThemeStudio() {
  const { refreshTheme } = useStoreTheme();
  const [activeThemeId, setActiveThemeId] = useState<string>(() => getActiveStoreThemeId());
  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => getActiveStoreThemeId());
  const [branding, setBranding] = useState<StoreBrandingConfig>(() => getActiveStoreBranding());
  const [storeSlug, setStoreSlug] = useState<string>("");
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"branding" | "colors" | "features">("branding");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const selectedTheme = STORE_THEMES[selectedThemeId] || STORE_THEMES[DEFAULT_THEME_ID];
  const activePublishedTheme = STORE_THEMES[activeThemeId] || STORE_THEMES[DEFAULT_THEME_ID];

  // Fetch remote settings on mount so Theme Studio reflects the actual live backend state
  useEffect(() => {
    let mounted = true;
    marketplaceApi.getThemeSettings()
      .then((data: any) => {
        if (!mounted || !data) return;
        if (data.theme_id && STORE_THEMES[data.theme_id]) {
          setActiveThemeId(data.theme_id);
          setSelectedThemeId(data.theme_id);
        }
        if (data.store_slug) {
          setStoreSlug(data.store_slug);
        }
        if (data.is_published !== undefined) {
          setIsPublished(data.is_published);
        }
        if (data.store_name || data.primary_color) {
          setBranding((prev) => ({
            ...prev,
            storeName: data.store_name,
            tagline: data.tagline,
            announcementText: data.announcement_text,
            supportPhone: data.support_phone,
            supportEmail: data.support_email,
            primaryColor: data.primary_color,
            accentColor: data.accent_color,
            bgTone: data.bg_tone,
          }));
        }
      })
      .catch((e) => console.debug("Studio remote theme fetch notice:", e));
    return () => { mounted = false; };
  }, []);

  // Effective values merging theme defaults with custom branding
  const effectiveStoreName = branding.storeName !== undefined ? branding.storeName : selectedTheme.name;
  const effectiveTagline = branding.tagline !== undefined ? branding.tagline : selectedTheme.tagline;
  const effectivePrimaryColor = branding.primaryColor || selectedTheme.primaryColor;
  const effectiveAccentColor = branding.accentColor || selectedTheme.accentColor;
  const effectiveBgTone = branding.bgTone || selectedTheme.bgTone;
  const effectiveAnnouncement = branding.announcementText || "🌿 100% Organically Nurtured Plants • Free Transit Health Guarantee • Same-Day Dispatch";
  const effectivePhone = branding.supportPhone || "+91 98450 12345";
  const effectiveEmail = branding.supportEmail || "support@businessos.store";

  // Slug validation helper
  const handleSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setStoreSlug(clean);
    if (!clean) {
      setSlugError(null);
      return;
    }
    if (clean.length < 3) {
      setSlugError("Store slug must be at least 3 characters long.");
    } else if (clean.length > 60) {
      setSlugError("Store slug cannot exceed 60 characters.");
    } else if (clean.startsWith("-") || clean.endsWith("-") || clean.includes("--")) {
      setSlugError("Slug cannot start or end with a hyphen or contain double hyphens.");
    } else if (RESERVED_SLUGS.has(clean)) {
      setSlugError(`"${clean}" is a reserved system keyword.`);
    } else {
      setSlugError(null);
    }
  };

  // Canonical public storefront URL
  const canonicalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/store${storeSlug ? `/${storeSlug}` : ""}`
    : `/store${storeSlug ? `/${storeSlug}` : ""}`;

  const handleCopyUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(canonicalUrl);
      setCopiedUrl(true);
      toast.success("Storefront URL copied to clipboard!");
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // When user switches selected template, update defaults if custom fields were clean
  const handleSelectTemplate = (id: string) => {
    setSelectedThemeId(id);
    const newTheme = STORE_THEMES[id];
    if (newTheme) {
      setBranding((prev) => ({
        ...prev,
        primaryColor: newTheme.primaryColor,
        accentColor: newTheme.accentColor,
        bgTone: newTheme.bgTone,
        storeName: newTheme.name,
        tagline: newTheme.tagline,
      }));
    }
  };

  // Save & Publish to Live Store
  const handleSaveAndPublish = async () => {
    if (slugError) {
      toast.error(slugError);
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        theme_id: selectedThemeId,
        store_name: effectiveStoreName,
        tagline: effectiveTagline,
        sector: selectedTheme.sector,
        announcement_text: effectiveAnnouncement,
        support_phone: effectivePhone,
        support_email: effectiveEmail,
        primary_color: effectivePrimaryColor,
        accent_color: effectiveAccentColor,
        bg_tone: effectiveBgTone,
        is_published: isPublished,
      };

      if (storeSlug && storeSlug.trim()) {
        payload.store_slug = storeSlug.trim().toLowerCase();
      }

      // 1. Persist to backend API first
      const res = await marketplaceApi.updateThemeSettings(payload);

      const returnedSlug = res?.theme?.store_slug || storeSlug;
      if (returnedSlug) {
        setStoreSlug(returnedSlug);
      }
      if (res?.theme?.is_published !== undefined) {
        setIsPublished(res.theme.is_published);
      }

      // 2. Only after backend confirms that the save succeeded, update local storage and active theme
      saveActiveStoreThemeSettings(selectedThemeId, {
        storeName: effectiveStoreName,
        tagline: effectiveTagline,
        announcementText: effectiveAnnouncement,
        supportPhone: effectivePhone,
        supportEmail: effectiveEmail,
        primaryColor: effectivePrimaryColor,
        accentColor: effectiveAccentColor,
        bgTone: effectiveBgTone,
      }, returnedSlug);

      setActiveThemeId(selectedThemeId);
      try {
        await refreshTheme(returnedSlug);
      } catch {}

      toast.success(
        `Template "${selectedTheme.name}" (${selectedTheme.sector}) saved & published successfully!`
      );
    } catch (err: any) {
      console.error("Backend theme save error:", err);
      const errorMsg =
        err?.detail ||
        err?.message ||
        (typeof err === "string" ? err : "Failed to save theme settings to server.");
      toast.error(typeof errorMsg === "string" ? errorMsg : "Failed to save theme settings to server.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    const t = STORE_THEMES[selectedThemeId];
    setBranding({
      storeName: t.name,
      tagline: t.tagline,
      primaryColor: t.primaryColor,
      accentColor: t.accentColor,
      bgTone: t.bgTone,
      announcementText: "🌿 100% Organically Nurtured Plants • Free Transit Health Guarantee • Same-Day Dispatch",
      supportPhone: "+91 98450 12345",
      supportEmail: "support@businessos.store",
    });
    toast.info(`Reset to default settings for "${t.name}"`);
  };

  const handleOpenStore = () => {
    window.open(canonicalUrl, "_blank");
  };

  const IconComponent = SECTOR_ICONS[selectedThemeId] || Store;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Palette className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Marketplace Storefront Themes & Templates
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your customer-facing web store design, industry sectors, colors, and branding — identical to how Invoice Templates are configured.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-border/60 hover:bg-muted"
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenStore}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-border/60 hover:bg-muted"
          >
            <ExternalLink className="size-3.5 text-purple-600" /> View Live Store
          </Button>

          <Button
            size="sm"
            onClick={handleSaveAndPublish}
            disabled={isSaving}
            className="flex items-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md cursor-pointer"
          >
            <Save className="size-4" />
            {isSaving ? "Publishing..." : "Save & Set Active Theme"}
          </Button>
        </div>
      </div>

      {/* ── Canonical Storefront URL & Publishing Status Bar ── */}
      <div className="p-4 rounded-2xl border border-gray-200 bg-white shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={cn(
                "size-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm",
                isPublished ? "bg-emerald-600" : "bg-amber-500"
              )}
            >
              <Globe className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                  Canonical Storefront URL
                </span>
                <span
                  className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1",
                    isPublished
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", isPublished ? "bg-emerald-600 animate-pulse" : "bg-amber-500")} />
                  {isPublished ? "Published & Live" : "Draft (Offline/Hidden)"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="text-xs sm:text-sm font-mono font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 break-all select-all">
                  {canonicalUrl}
                </code>
              </div>
            </div>
          </div>

          {/* Action buttons: Copy URL, Open Live, Publish Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer shadow-2xs"
            >
              {copiedUrl ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copiedUrl ? "Copied!" : "Copy URL"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenStore}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors cursor-pointer shadow-2xs"
            >
              <ExternalLink className="size-3.5" />
              <span>Open Store</span>
            </button>

            {/* Publication Toggle */}
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs",
                isPublished
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              )}
            >
              {isPublished ? <CheckCircle className="size-3.5" /> : <Lock className="size-3.5" />}
              <span>{isPublished ? "Store is Public" : "Make Public"}</span>
            </button>
          </div>
        </div>

        {/* Store Slug Configuration Row */}
        <div className="pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-gray-800 mb-0.5">
              Dedicated Store URL Slug
            </label>
            <p className="text-[11px] text-gray-500">
              Unique path identifier for your organization (e.g. <code>greenflora</code>, <code>fashionhub</code>).
            </p>
          </div>

          <div className="md:col-span-8 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 shrink-0">/store/</span>
              <input
                type="text"
                value={storeSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="your-custom-slug"
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-mono font-bold bg-gray-50 border rounded-xl outline-none transition-colors",
                  slugError ? "border-red-500 bg-red-50/30 text-red-900" : "border-gray-200 focus:border-purple-500 focus:bg-white"
                )}
              />
            </div>
            {slugError && (
              <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" /> {slugError}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Template Cards Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <span>Select Sector Template</span>
            <span className="text-xs font-normal text-muted-foreground">
              (6 Industry Architectures Available)
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">
            Selected: <strong className="text-purple-700 font-semibold">{selectedTheme.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(STORE_THEMES).map((t) => {
            const isThemeLive = activeThemeId === t.id;
            const isCurrentlySelected = selectedThemeId === t.id;
            const Icon = SECTOR_ICONS[t.id] || Store;

            return (
              <div
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                className={cn(
                  "relative p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between text-left",
                  isCurrentlySelected
                    ? "border-purple-500 bg-purple-50/20 shadow-md ring-2 ring-purple-500/20"
                    : "border-border/70 bg-card hover:border-purple-300 hover:shadow-xs",
                  isThemeLive && !isCurrentlySelected && "border-emerald-400 bg-emerald-50/10"
                )}
              >
                {/* Header Strip */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: t.primaryColor }}
                      >
                        <Icon className="size-4 font-bold" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground leading-tight">
                          {t.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {t.sector}
                        </p>
                      </div>
                    </div>

                    {isThemeLive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Check className="size-3" /> Live
                      </span>
                    ) : isCurrentlySelected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Selected
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                {/* Footer details: Palette & Features */}
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  {/* Color Swatches */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="size-4 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: t.primaryColor }}
                      title={`Primary: ${t.primaryColor}`}
                    />
                    <div
                      className="size-4 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: t.accentColor }}
                      title={`Accent: ${t.accentColor}`}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground ml-1">
                      {t.badgeText}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "text-xs font-bold transition-colors",
                      isCurrentlySelected ? "text-purple-600" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isCurrentlySelected ? "Editing Settings →" : "Select"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Customization & Live Mockup Split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Left Column: Settings Customizer (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border border-border/70 rounded-xl bg-card p-5 space-y-4 shadow-2xs">
            {/* Tabs for customization */}
            <div className="flex items-center gap-2 border-b border-border/50 pb-3">
              <button
                onClick={() => setActiveTab("branding")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                  activeTab === "branding"
                    ? "bg-purple-100 text-purple-800"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                1. Store Branding
              </button>
              <button
                onClick={() => setActiveTab("colors")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                  activeTab === "colors"
                    ? "bg-purple-100 text-purple-800"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                2. Colors & Typography
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                  activeTab === "features"
                    ? "bg-purple-100 text-purple-800"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                3. Industry Features
              </button>
            </div>

            {/* Tab 1: Branding Fields */}
            {activeTab === "branding" && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Store Brand Name
                  </label>
                  <input
                    type="text"
                    value={effectiveStoreName}
                    onChange={(e) => setBranding({ ...branding, storeName: e.target.value })}
                    placeholder="e.g. GreenFlora Nursery, MedPlus Pharmacy"
                    className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Displayed prominently on header logos and mobile navigation.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Store Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={effectiveTagline}
                    onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                    placeholder="e.g. Botanical Nursery, Plants & Living Decor"
                    className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Top Announcement Bar Text
                  </label>
                  <input
                    type="text"
                    value={effectiveAnnouncement}
                    onChange={(e) => setBranding({ ...branding, announcementText: e.target.value })}
                    placeholder="e.g. 100% Organically Nurtured Plants • Free Transit Health Guarantee"
                    className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      Customer Helpline Phone
                    </label>
                    <input
                      type="text"
                      value={effectivePhone}
                      onChange={(e) => setBranding({ ...branding, supportPhone: e.target.value })}
                      placeholder="+91 98450 12345"
                      className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={effectiveEmail}
                      onChange={(e) => setBranding({ ...branding, supportEmail: e.target.value })}
                      placeholder="care@greenflora.in"
                      className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Color Palette */}
            {activeTab === "colors" && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      Primary Brand Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectivePrimaryColor}
                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                        className="size-9 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                      />
                      <input
                        type="text"
                        value={effectivePrimaryColor}
                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                        className="w-full font-mono uppercase px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      Accent / Button Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveAccentColor}
                        onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                        className="size-9 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                      />
                      <input
                        type="text"
                        value={effectiveAccentColor}
                        onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                        className="w-full font-mono uppercase px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-foreground mb-1">
                    Store Canvas Background Tone
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={effectiveBgTone}
                      onChange={(e) => setBranding({ ...branding, bgTone: e.target.value })}
                      className="size-9 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                    />
                    <input
                      type="text"
                      value={effectiveBgTone}
                      onChange={(e) => setBranding({ ...branding, bgTone: e.target.value })}
                      className="w-full font-mono uppercase px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Soft tinted canvas background for entire public storefront layout.
                  </span>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 text-foreground font-bold">
                    <Type className="size-4 text-purple-600" />
                    <span>Selected Font Family: {selectedTheme.fontFamily}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Optimized for maximum readability and conversion within the {selectedTheme.sector} sector.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Sector Features */}
            {activeTab === "features" && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-200">
                  <h4 className="font-bold text-purple-900 mb-1">
                    {selectedTheme.sector} Industry Specialized Modules
                  </h4>
                  <p className="text-[11px] text-purple-700">
                    Switching to this template automatically activates these specialized shopping features on your store:
                  </p>
                </div>

                <ul className="space-y-2">
                  {(SECTOR_FEATURES[selectedThemeId] || []).map((feat, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/60 text-slate-800 font-medium"
                    >
                      <Check className="size-4 text-emerald-600 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bottom Save Action */}
            <div className="pt-3 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Changes persist to backend database and sync across all shopper sessions.
              </span>
              <Button
                size="sm"
                onClick={handleSaveAndPublish}
                disabled={isSaving}
                className="flex items-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 cursor-pointer shadow-xs"
              >
                <Check className="size-3.5" /> Publish to Live Store
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Mockup Preview Frame (6 Cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Eye className="size-3.5 text-purple-600" /> Live Template Preview
            </span>

            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/60 text-xs">
              <button
                onClick={() => setPreviewDevice("desktop")}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  previewDevice === "desktop" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground"
                )}
                title="Desktop View"
              >
                <Monitor className="size-3.5" />
              </button>
              <button
                onClick={() => setPreviewDevice("mobile")}
                className={cn(
                  "p-1.5 rounded-md transition-colors cursor-pointer",
                  previewDevice === "mobile" ? "bg-background text-foreground shadow-2xs font-bold" : "text-muted-foreground"
                )}
                title="Mobile View"
              >
                <Smartphone className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Miniature Store Browser Frame */}
          <div
            className={cn(
              "mx-auto border border-slate-300 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 bg-white",
              previewDevice === "mobile" ? "max-w-[340px]" : "w-full"
            )}
            style={{ backgroundColor: effectiveBgTone }}
          >
            {/* Browser top pill */}
            <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <div className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-rose-400" />
                <div className="size-2 rounded-full bg-amber-400" />
                <div className="size-2 rounded-full bg-emerald-400" />
              </div>
              <span className="truncate">{canonicalUrl}</span>
            </div>

            {/* Mockup Store Announcement Bar */}
            <div
              className="px-3 py-1 text-[10px] font-semibold text-white truncate flex items-center justify-between"
              style={{ backgroundColor: effectivePrimaryColor }}
            >
              <span className="truncate">{effectiveAnnouncement}</span>
              <span className="hidden sm:inline font-mono shrink-0 ml-2">{effectivePhone}</span>
            </div>

            {/* Mockup Store Header */}
            <div className="p-3 border-b border-black/5 bg-white/80 backdrop-blur-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="size-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                  style={{ backgroundColor: effectivePrimaryColor }}
                >
                  <IconComponent className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 leading-tight">
                    {effectiveStoreName}
                  </div>
                  <div className="text-[9px] text-slate-500 leading-none truncate max-w-[140px]">
                    {effectiveTagline}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-md text-[10px] text-slate-400">
                  <Search className="size-3" />
                  <span>Search products...</span>
                </div>
                <Heart className="size-4 text-slate-400" />
                <div className="relative">
                  <ShoppingCart className="size-4" style={{ color: effectivePrimaryColor }} />
                  <span
                    className="absolute -top-1 -right-1 text-[8px] text-white rounded-full size-3 flex items-center justify-center font-bold"
                    style={{ backgroundColor: effectiveAccentColor }}
                  >
                    2
                  </span>
                </div>
              </div>
            </div>

            {/* Mockup Hero Banner */}
            <div className="p-4 sm:p-6 bg-gradient-to-br from-black/5 to-black/0 text-left border-b border-black/5">
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mb-2 shadow-2xs text-white"
                style={{ backgroundColor: effectiveAccentColor }}
              >
                {selectedTheme.badgeText}
              </span>

              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {selectedThemeId === "nursery_botanics" && "Bring Living Nature Indoors With Curated Botanicals."}
                {selectedThemeId === "pharma_medical" && "Certified Healthcare, Genuine Rx Medicines & Wellness."}
                {selectedThemeId === "modern_fresh" && "Farm Fresh Fruits, Organic Greens & Daily Grocery."}
                {selectedThemeId === "fashion_boutique" && "Contemporary Luxury Apparel, Designer Wear & Lookbooks."}
                {selectedThemeId === "mega_market" && "Next-Gen Tech Gadgets, Laptops & Certified Hardware."}
                {selectedThemeId === "speed_mart" && "Instant 10-Minute Hyperlocal Essentials Delivered Fast."}
              </h3>

              <p className="text-[11px] text-slate-600 mt-1 max-w-sm leading-relaxed">
                {selectedTheme.description}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs cursor-default"
                  style={{ backgroundColor: effectivePrimaryColor }}
                >
                  Shop Catalog →
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 cursor-default">
                  Explore Categories
                </button>
              </div>
            </div>

            {/* Sample Mini Product Preview */}
            <div className="p-3 bg-white">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Sample Product Card Layout
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="size-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: effectivePrimaryColor }}
                  >
                    <IconComponent className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Featured Catalog Product
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Standard Retail SKU &bull; In Stock
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">₹450.00</div>
                  <button
                    className="text-[10px] font-bold px-2 py-0.5 rounded text-white mt-0.5"
                    style={{ backgroundColor: effectiveAccentColor }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="p-2.5 text-center text-[10px] text-slate-400 border-t border-slate-100">
              &copy; {new Date().getFullYear()} {effectiveStoreName} &bull; Powered by BusinessOS Multi-SaaS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
