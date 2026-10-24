import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { STORE_THEMES, StoreThemeConfig, DEFAULT_THEME_ID } from "@/data/storeThemesConfig";
import { toast } from "sonner";
import { marketplaceApi } from "@/lib/api-client";

export interface StoreBrandingConfig {
  storeName?: string;
  tagline?: string;
  announcementText?: string;
  supportPhone?: string;
  supportEmail?: string;
  primaryColor?: string;
  accentColor?: string;
  bgTone?: string;
}

export interface StoreThemeContextType {
  themeId: string;
  theme: StoreThemeConfig;
  branding: StoreBrandingConfig;
  setThemeId: (id: string, notify?: boolean) => void;
  updateBranding: (branding: Partial<StoreBrandingConfig>) => void;
  saveThemeAndBranding: (
    id: string,
    branding?: Partial<StoreBrandingConfig>,
    notify?: boolean,
    customStoreSlug?: string,
    isPublished?: boolean
  ) => Promise<void>;
  availableThemes: StoreThemeConfig[];
  refreshTheme: (overrideStoreSlug?: string) => Promise<void>;
  storeSlug: string | null;
  isLoading: boolean;
  isStoreNotFound: boolean;
  isPublished: boolean;
  getStoreUrl: (subpath?: string) => string;
}

const defaultTheme = STORE_THEMES[DEFAULT_THEME_ID];
export const defaultStoreThemeContextValue: StoreThemeContextType = {
  themeId: DEFAULT_THEME_ID,
  theme: defaultTheme,
  branding: {},
  setThemeId: () => {},
  updateBranding: () => {},
  saveThemeAndBranding: async () => {},
  availableThemes: Object.values(STORE_THEMES),
  refreshTheme: async () => {},
  storeSlug: null,
  isLoading: false,
  isStoreNotFound: false,
  isPublished: true,
  getStoreUrl: (subpath = "") => `/store${subpath}`,
};

export const StoreThemeContext = createContext<StoreThemeContextType>(defaultStoreThemeContextValue);

const THEME_BROADCAST_CHANNEL = "businessos_store_theme_sync";

// Known static routes under /store to distinguish from store slugs
export const KNOWN_STORE_SUBROUTES = new Set([
  "",
  "about",
  "account",
  "addresses",
  "blog",
  "cart",
  "checkout",
  "collection",
  "contact",
  "orders",
  "pages",
  "product",
  "register",
  "search",
  "security",
  "shop",
  "styles",
  "thank-you",
  "wallet",
  "wishlist",
]);

// Alias mapping for short URL params (e.g. ?theme=nursery -> nursery_botanics)
export const THEME_ALIASES: Record<string, string> = {
  nursery: "nursery_botanics",
  plant: "nursery_botanics",
  plants: "nursery_botanics",
  pharma: "pharma_medical",
  medical: "pharma_medical",
  fresh: "modern_fresh",
  grocery: "modern_fresh",
  organic: "modern_fresh",
  fashion: "fashion_boutique",
  clothing: "fashion_boutique",
  tech: "mega_market",
  electronics: "mega_market",
  mega: "mega_market",
  speed: "speed_mart",
  quick: "speed_mart",
  mart: "speed_mart",
};

/**
 * Extracts the current store slug from pathname (/store/:storeSlug) or search params (?store=... / ?tenant=...).
 */
export function getStoreSlugFromUrl(): string | null {
  if (typeof window !== "undefined") {
    try {
      // 1. Path-based check: /store/:storeSlug or /store/:storeSlug/shop
      const pathname = window.location.pathname;
      if (pathname.startsWith("/store/")) {
        const parts = pathname.slice("/store/".length).split("/").filter(Boolean);
        if (parts.length > 0) {
          const candidate = parts[0].toLowerCase().trim();
          if (!KNOWN_STORE_SUBROUTES.has(candidate)) {
            return candidate;
          }
        }
      }

      // 2. Query param fallback: ?store=... or ?tenant=...
      const params = new URLSearchParams(window.location.search);
      const storeParam = params.get("store")?.trim() || params.get("tenant")?.trim();
      if (storeParam) return storeParam.toLowerCase();
    } catch {}
  }
  return null;
}

/**
 * Resolves canonical store-scoped link to preserve store context across navigation.
 */
export function getStoreUrl(subpath: string = "", storeSlug?: string | null): string {
  const currentSlug = storeSlug !== undefined ? storeSlug : getStoreSlugFromUrl();
  const clean = subpath.trim().replace(/^\/?store\/?/, "/");
  const normalized = clean.startsWith("/") ? clean : `/${clean}`;

  if (currentSlug) {
    if (normalized === "/" || normalized === "") {
      return `/store/${currentSlug}`;
    }
    return `/store${normalized}?store=${currentSlug}`;
  }
  return normalized === "/" || normalized === "" ? "/store" : `/store${normalized}`;
}

/**
 * Builds a store-isolated localStorage key to prevent cross-store theme and branding leakage.
 */
export function getStoreStorageKey(prefix: string, storeSlug?: string | null): string {
  const slug = storeSlug !== undefined ? storeSlug : getStoreSlugFromUrl();
  if (slug) {
    return `${prefix}_store_${slug.toLowerCase()}`;
  }
  if (typeof window !== "undefined") {
    try {
      const storedTenant = localStorage.getItem("bos-tenant");
      if (storedTenant) {
        const parsed = JSON.parse(storedTenant);
        const tid = parsed?.raw?.tenant_id || parsed?.tenant_id || parsed?.id;
        if (tid && typeof tid === "string" && tid.length > 5) {
          return `${prefix}_tenant_${tid}`;
        }
      }
    } catch {}
  }
  return `${prefix}_default`;
}

export function getActiveStoreThemeId(storeSlug?: string | null): string {
  if (typeof window !== "undefined") {
    const key = getStoreStorageKey("businessos_store_active_theme", storeSlug);
    const saved = localStorage.getItem(key);
    if (saved && STORE_THEMES[saved]) return saved;
  }
  return DEFAULT_THEME_ID;
}

export function getActiveStoreBranding(storeSlug?: string | null): StoreBrandingConfig {
  if (typeof window !== "undefined") {
    try {
      const key = getStoreStorageKey("businessos_store_branding_config", storeSlug);
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  return {};
}

export function saveActiveStoreThemeSettings(
  themeId: string,
  branding?: StoreBrandingConfig,
  storeSlug?: string | null
): void {
  if (typeof window !== "undefined") {
    const resolvedId = THEME_ALIASES[themeId] || themeId;
    const currentSlug = storeSlug !== undefined ? storeSlug : getStoreSlugFromUrl();
    const themeKey = getStoreStorageKey("businessos_store_active_theme", currentSlug);
    const brandingKey = getStoreStorageKey("businessos_store_branding_config", currentSlug);

    try {
      localStorage.setItem(themeKey, resolvedId);
      if (branding) {
        localStorage.setItem(brandingKey, JSON.stringify(branding));
      }
    } catch {}

    window.dispatchEvent(new Event("storage"));
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(THEME_BROADCAST_CHANNEL);
        bc.postMessage({ themeId: resolvedId, branding, storeSlug: currentSlug });
        bc.close();
      }
    } catch {}
  }
}

export function StoreThemeProvider({ children }: { children: React.ReactNode }) {
  const [storeSlug, setStoreSlug] = useState<string | null>(() => getStoreSlugFromUrl());
  const [isLoading, setIsLoading] = useState(false);
  const [isStoreNotFound, setIsStoreNotFound] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  const [themeId, setThemeIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTheme = params.get("theme")?.toLowerCase().trim();
      if (urlTheme) {
        if (STORE_THEMES[urlTheme]) return urlTheme;
        if (THEME_ALIASES[urlTheme] && STORE_THEMES[THEME_ALIASES[urlTheme]]) {
          return THEME_ALIASES[urlTheme];
        }
      }
    }
    return getActiveStoreThemeId(getStoreSlugFromUrl());
  });

  const [branding, setBrandingState] = useState<StoreBrandingConfig>(() =>
    getActiveStoreBranding(getStoreSlugFromUrl())
  );

  // Function to pull latest published theme from backend API
  const refreshTheme = useCallback(async (overrideStoreSlug?: string) => {
    const targetSlug = overrideStoreSlug !== undefined ? overrideStoreSlug : getStoreSlugFromUrl();
    setIsLoading(true);
    try {
      const res = await marketplaceApi.getThemeSettings(targetSlug ? { store: targetSlug } : undefined);
      if (res && res.theme_id && STORE_THEMES[res.theme_id]) {
        setIsStoreNotFound(false);
        setThemeIdState(res.theme_id);
        if (res.store_slug) {
          setStoreSlug(res.store_slug);
        }
        if (res.is_published !== undefined) {
          setIsPublished(res.is_published);
        }

        const serverBranding: StoreBrandingConfig = {
          storeName: res.store_name,
          tagline: res.tagline,
          announcementText: res.announcement_text,
          supportPhone: res.support_phone,
          supportEmail: res.support_email,
          primaryColor: res.primary_color,
          accentColor: res.accent_color,
          bgTone: res.bg_tone,
        };
        setBrandingState(serverBranding);

        // Store into store-scoped cache
        saveActiveStoreThemeSettings(res.theme_id, serverBranding, targetSlug || res.store_slug);
      }
    } catch (err: any) {
      console.debug("Remote theme load notice for store:", targetSlug, err);
      // If store lookup fails (e.g. unknown 404 store slug or unpublished), set not found
      if (targetSlug) {
        setIsStoreNotFound(true);
        setThemeIdState(DEFAULT_THEME_ID);
        setBrandingState({});
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1. Fetch remote settings from backend on mount or when URL changes
  useEffect(() => {
    const currentSlug = getStoreSlugFromUrl();
    setStoreSlug(currentSlug);
    refreshTheme(currentSlug || undefined);
  }, [refreshTheme]);

  // Listen to popstate and pushstate url changes to update store slug and reload isolated theme
  useEffect(() => {
    const handleUrlChange = () => {
      const newSlug = getStoreSlugFromUrl();
      if (newSlug !== storeSlug) {
        setStoreSlug(newSlug);
        setIsStoreNotFound(false);
        // Wipe in-memory state first to prevent theme leakage between stores
        setThemeIdState(getActiveStoreThemeId(newSlug));
        setBrandingState(getActiveStoreBranding(newSlug));
        refreshTheme(newSlug || undefined);
      }
    };

    window.addEventListener("popstate", handleUrlChange);
    return () => window.removeEventListener("popstate", handleUrlChange);
  }, [storeSlug, refreshTheme]);

  // 2. Listen for BroadcastChannel updates (fires instantly across tabs on the same domain)
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel(THEME_BROADCAST_CHANNEL);
    bc.onmessage = (event) => {
      const eventStore = event.data?.storeSlug;
      const currentSlug = getStoreSlugFromUrl();
      // Only process updates meant for the currently active store scope
      if (eventStore === currentSlug || (!eventStore && !currentSlug)) {
        if (event.data?.themeId && STORE_THEMES[event.data.themeId]) {
          setThemeIdState(event.data.themeId);
        }
        if (event.data?.branding) {
          setBrandingState((prev) => ({ ...prev, ...event.data.branding }));
        }
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  // 3. Listen for storage changes from other windows/tabs
  useEffect(() => {
    const handleStorage = () => {
      const currentSlug = getStoreSlugFromUrl();
      setThemeIdState(getActiveStoreThemeId(currentSlug));
      setBrandingState(getActiveStoreBranding(currentSlug));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const baseTheme = STORE_THEMES[themeId] || STORE_THEMES[DEFAULT_THEME_ID];

  // Merge custom branding overrides into active theme with safe defaults
  const activeTheme = useMemo<StoreThemeConfig>(() => {
    return {
      ...baseTheme,
      name: branding.storeName?.trim() || baseTheme.name,
      tagline: branding.tagline?.trim() || baseTheme.tagline,
      primaryColor: branding.primaryColor?.trim() || baseTheme.primaryColor,
      accentColor: branding.accentColor?.trim() || baseTheme.accentColor,
      bgTone: branding.bgTone?.trim() || baseTheme.bgTone,
    };
  }, [baseTheme, branding]);

  // Apply CSS color variables on theme change to both store-theme and organic tokens
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--store-theme-primary", activeTheme.primaryColor);
      root.style.setProperty("--store-theme-accent", activeTheme.accentColor);
      root.style.setProperty("--store-theme-bg", activeTheme.bgTone);

      // Wire organic theme CSS variables so components immediately render dynamic theme colors
      root.style.setProperty("--organic-primary", activeTheme.primaryColor);
      root.style.setProperty("--organic-accent", activeTheme.accentColor);
      root.style.setProperty("--organic-cream", activeTheme.bgTone);
    }
  }, [activeTheme]);

  const setThemeId = (newId: string, notify = true) => {
    const resolvedId = THEME_ALIASES[newId] || newId;
    if (STORE_THEMES[resolvedId]) {
      setThemeIdState(resolvedId);
      saveActiveStoreThemeSettings(resolvedId, branding, storeSlug);
      if (notify) {
        toast.success(`Switched to "${STORE_THEMES[resolvedId].name}" theme (${STORE_THEMES[resolvedId].sector})`);
      }
    }
  };

  const updateBranding = (newBranding: Partial<StoreBrandingConfig>) => {
    setBrandingState((prev) => {
      const updated = { ...prev, ...newBranding };
      saveActiveStoreThemeSettings(themeId, updated, storeSlug);
      return updated;
    });
  };

  const saveThemeAndBranding = async (
    newId: string,
    newBranding?: Partial<StoreBrandingConfig>,
    notify = true,
    customStoreSlug?: string,
    newIsPublished?: boolean
  ) => {
    const resolvedId = THEME_ALIASES[newId] || newId;
    if (!STORE_THEMES[resolvedId]) return;

    const base = STORE_THEMES[resolvedId];
    const mergedBranding: StoreBrandingConfig = {
      ...branding,
      ...newBranding,
    };

    const payload: any = {
      theme_id: resolvedId,
      store_name: mergedBranding.storeName || base.name,
      tagline: mergedBranding.tagline || base.tagline,
      sector: base.sector,
      announcement_text: mergedBranding.announcementText || "🌿 Special Offer: Free Delivery on orders above ₹499",
      support_phone: mergedBranding.supportPhone,
      support_email: mergedBranding.supportEmail,
      primary_color: mergedBranding.primaryColor || base.primaryColor,
      accent_color: mergedBranding.accentColor || base.accentColor,
      bg_tone: mergedBranding.bgTone || base.bgTone,
    };

    if (customStoreSlug) {
      payload.store_slug = customStoreSlug;
    }
    if (newIsPublished !== undefined) {
      payload.is_published = newIsPublished;
    }

    try {
      const res = await marketplaceApi.updateThemeSettings(payload);
      setThemeIdState(resolvedId);
      setBrandingState(mergedBranding);
      const effectiveSlug = res?.theme?.store_slug || customStoreSlug || storeSlug;
      if (effectiveSlug) {
        setStoreSlug(effectiveSlug);
      }
      if (res?.theme?.is_published !== undefined) {
        setIsPublished(res.theme.is_published);
      }
      saveActiveStoreThemeSettings(resolvedId, mergedBranding, effectiveSlug);
      if (notify) {
        toast.success(`Published "${STORE_THEMES[resolvedId].name}" template to live store!`);
      }
    } catch (err: any) {
      console.error("Theme save failed:", err);
      const msg = err?.detail || err?.message || "Failed to save theme settings to backend";
      toast.error(typeof msg === "string" ? msg : "Failed to save theme settings to backend");
      throw err;
    }
  };

  return (
    <StoreThemeContext.Provider
      value={{
        themeId,
        theme: activeTheme,
        branding,
        setThemeId,
        updateBranding,
        saveThemeAndBranding,
        availableThemes: Object.values(STORE_THEMES),
        refreshTheme,
        storeSlug,
        isLoading,
        isStoreNotFound,
        isPublished,
        getStoreUrl: (subpath = "") => getStoreUrl(subpath, storeSlug),
      }}
    >
      {children}
    </StoreThemeContext.Provider>
  );
}

export function useStoreTheme() {
  const context = useContext(StoreThemeContext);
  return context || defaultStoreThemeContextValue;
}
