import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
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

interface StoreThemeContextType {
  themeId: string;
  theme: StoreThemeConfig;
  branding: StoreBrandingConfig;
  setThemeId: (id: string, notify?: boolean) => void;
  updateBranding: (branding: Partial<StoreBrandingConfig>) => void;
  saveThemeAndBranding: (id: string, branding?: Partial<StoreBrandingConfig>, notify?: boolean) => void;
  availableThemes: StoreThemeConfig[];
  refreshTheme: () => Promise<void>;
}

const defaultTheme = STORE_THEMES[DEFAULT_THEME_ID];
export const defaultStoreThemeContextValue: StoreThemeContextType = {
  themeId: DEFAULT_THEME_ID,
  theme: defaultTheme,
  branding: {},
  setThemeId: () => {},
  updateBranding: () => {},
  saveThemeAndBranding: () => {},
  availableThemes: Object.values(STORE_THEMES),
  refreshTheme: async () => {},
};

export const StoreThemeContext = createContext<StoreThemeContextType>(defaultStoreThemeContextValue);

const THEME_BROADCAST_CHANNEL = "businessos_store_theme_sync";

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

export function getActiveStoreThemeId(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("businessos_store_active_theme");
    if (saved && STORE_THEMES[saved]) return saved;
  }
  return DEFAULT_THEME_ID;
}

export function getActiveStoreBranding(): StoreBrandingConfig {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("businessos_store_branding_config");
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  return {};
}

export function saveActiveStoreThemeSettings(themeId: string, branding?: StoreBrandingConfig): void {
  if (typeof window !== "undefined") {
    const resolvedId = THEME_ALIASES[themeId] || themeId;
    try {
      localStorage.setItem("businessos_store_active_theme", resolvedId);
      if (branding) {
        localStorage.setItem("businessos_store_branding_config", JSON.stringify(branding));
      }
    } catch {}
    window.dispatchEvent(new Event("storage"));
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(THEME_BROADCAST_CHANNEL);
        bc.postMessage({ themeId: resolvedId, branding });
        bc.close();
      }
    } catch {}
  }
}

export function StoreThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(() => {
    // 1. Check URL parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTheme = params.get("theme")?.toLowerCase().trim();
      if (urlTheme) {
        if (STORE_THEMES[urlTheme]) return urlTheme;
        if (THEME_ALIASES[urlTheme] && STORE_THEMES[THEME_ALIASES[urlTheme]]) {
          return THEME_ALIASES[urlTheme];
        }
      }
      // 2. Check LocalStorage
      const saved = localStorage.getItem("businessos_store_active_theme");
      if (saved && STORE_THEMES[saved]) {
        return saved;
      }
    }
    return DEFAULT_THEME_ID;
  });

  const [branding, setBrandingState] = useState<StoreBrandingConfig>(() => getActiveStoreBranding());

  // Function to pull latest published theme from backend API
  const refreshTheme = async () => {
    try {
      const res = await marketplaceApi.getThemeSettings();
      if (res && res.theme_id && STORE_THEMES[res.theme_id]) {
        setThemeIdState(res.theme_id);
        try {
          localStorage.setItem("businessos_store_active_theme", res.theme_id);
        } catch {}

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
        setBrandingState((prev) => ({ ...prev, ...serverBranding }));
        try {
          localStorage.setItem("businessos_store_branding_config", JSON.stringify(serverBranding));
        } catch {}
      }
    } catch (err) {
      console.debug("Remote theme load notice:", err);
    }
  };

  // 1. Fetch remote settings from backend on mount (ensures incognito & new tabs stay in sync!)
  useEffect(() => {
    refreshTheme();
  }, []);

  // 2. Listen for BroadcastChannel updates (fires instantly across tabs on the same domain)
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel(THEME_BROADCAST_CHANNEL);
    bc.onmessage = (event) => {
      if (event.data?.themeId && STORE_THEMES[event.data.themeId]) {
        setThemeIdState(event.data.themeId);
      }
      if (event.data?.branding) {
        setBrandingState((prev) => ({ ...prev, ...event.data.branding }));
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  // 3. Listen for storage changes from other windows/tabs
  useEffect(() => {
    const handleStorage = () => {
      const currentTheme = getActiveStoreThemeId();
      setThemeIdState(currentTheme);
      setBrandingState(getActiveStoreBranding());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const baseTheme = STORE_THEMES[themeId] || STORE_THEMES[DEFAULT_THEME_ID];

  // Merge custom branding overrides into active theme
  const activeTheme = useMemo<StoreThemeConfig>(() => {
    return {
      ...baseTheme,
      name: branding.storeName || baseTheme.name,
      tagline: branding.tagline || baseTheme.tagline,
      primaryColor: branding.primaryColor || baseTheme.primaryColor,
      accentColor: branding.accentColor || baseTheme.accentColor,
      bgTone: branding.bgTone || baseTheme.bgTone,
    };
  }, [baseTheme, branding]);

  // Apply CSS color variables on theme change
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--store-theme-primary", activeTheme.primaryColor);
      root.style.setProperty("--store-theme-accent", activeTheme.accentColor);
      root.style.setProperty("--store-theme-bg", activeTheme.bgTone);
    }
  }, [activeTheme]);

  const setThemeId = (newId: string, notify = true) => {
    const resolvedId = THEME_ALIASES[newId] || newId;
    if (STORE_THEMES[resolvedId]) {
      setThemeIdState(resolvedId);
      localStorage.setItem("businessos_store_active_theme", resolvedId);
      if (notify) {
        toast.success(`Switched to "${STORE_THEMES[resolvedId].name}" theme (${STORE_THEMES[resolvedId].sector})`);
      }
    }
  };

  const updateBranding = (newBranding: Partial<StoreBrandingConfig>) => {
    setBrandingState((prev) => {
      const updated = { ...prev, ...newBranding };
      localStorage.setItem("businessos_store_branding_config", JSON.stringify(updated));
      return updated;
    });
  };

  const saveThemeAndBranding = (newId: string, newBranding?: Partial<StoreBrandingConfig>, notify = true) => {
    const resolvedId = THEME_ALIASES[newId] || newId;
    if (STORE_THEMES[resolvedId]) {
      setThemeIdState(resolvedId);
      localStorage.setItem("businessos_store_active_theme", resolvedId);
      if (newBranding) {
        setBrandingState((prev) => {
          const updated = { ...prev, ...newBranding };
          localStorage.setItem("businessos_store_branding_config", JSON.stringify(updated));
          return updated;
        });
      }
      if (notify) {
        toast.success(`Published "${STORE_THEMES[resolvedId].name}" template to live store!`);
      }
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
