import React, { createContext, useContext, useState, useEffect } from "react";
import { STORE_THEMES, StoreThemeConfig, DEFAULT_THEME_ID } from "@/data/storeThemesConfig";
import { toast } from "sonner";

interface StoreThemeContextType {
  themeId: string;
  theme: StoreThemeConfig;
  setThemeId: (id: string, notify?: boolean) => void;
  availableThemes: StoreThemeConfig[];
}

const StoreThemeContext = createContext<StoreThemeContextType | undefined>(undefined);

// Alias mapping for short URL params (e.g. ?theme=nursery -> nursery_botanics)
const THEME_ALIASES: Record<string, string> = {
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

  const activeTheme = STORE_THEMES[themeId] || STORE_THEMES[DEFAULT_THEME_ID];

  // Apply CSS color variables on theme change
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--store-theme-primary", activeTheme.primaryColor);
      root.style.setProperty("--store-theme-accent", activeTheme.accentColor);
      root.style.setProperty("--store-theme-bg", activeTheme.bgTone);
    }
  }, [themeId, activeTheme]);

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

  return (
    <StoreThemeContext.Provider
      value={{
        themeId,
        theme: activeTheme,
        setThemeId,
        availableThemes: Object.values(STORE_THEMES),
      }}
    >
      {children}
    </StoreThemeContext.Provider>
  );
}

export function useStoreTheme() {
  const context = useContext(StoreThemeContext);
  if (!context) {
    throw new Error("useStoreTheme must be used within a StoreThemeProvider");
  }
  return context;
}
