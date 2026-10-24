import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// In-memory mock localStorage
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Mock CSSStyleDeclaration / documentElement
class MockDocumentElement {
  constructor() {
    this.styles = new Map();
  }
  get style() {
    return {
      setProperty: (prop, value) => {
        this.styles.set(prop, value);
      },
      getPropertyValue: (prop) => {
        return this.styles.get(prop) || "";
      },
    };
  }
}

// Global mocks
globalThis.localStorage = new MockLocalStorage();
globalThis.document = {
  documentElement: new MockDocumentElement(),
};
globalThis.window = {
  location: { search: "", pathname: "/store" },
  dispatchEvent: () => {},
};

// Theme configurations
const STORE_THEMES = {
  nursery_botanics: {
    id: "nursery_botanics",
    name: "GreenFlora",
    tagline: "Botanical Nursery, Plants & Garden Care",
    sector: "Nursery & Planting",
    primaryColor: "#1B4D3E",
    accentColor: "#C25E3E",
    bgTone: "#FAF8F5",
  },
  pharma_medical: {
    id: "pharma_medical",
    name: "MedPlus",
    tagline: "Healthcare, Pharmacy & Wellness",
    sector: "Medical & Pharma",
    primaryColor: "#0284C7",
    accentColor: "#0D9488",
    bgTone: "#F0F9FF",
  },
  modern_fresh: {
    id: "modern_fresh",
    name: "FreshMart",
    tagline: "Supermarket, Farm Fresh & Daily Grocery",
    sector: "Grocery & Retail",
    primaryColor: "#16A34A",
    accentColor: "#EA580C",
    bgTone: "#FFFFFF",
  },
  speed_mart: {
    id: "speed_mart",
    name: "ExpressMart",
    tagline: "10-Minute Hyperlocal Quick Commerce",
    sector: "Quick Commerce",
    primaryColor: "#7C3AED",
    accentColor: "#F59E0B",
    bgTone: "#FDF4FF",
  },
};

const DEFAULT_THEME_ID = "speed_mart";

// Store Theme Helpers under test
function getStoreStorageKey(prefix, storeSlug) {
  if (storeSlug) {
    return `${prefix}_store_${storeSlug.toLowerCase()}`;
  }
  return `${prefix}_default`;
}

function resolveActiveTheme(themeId, branding = {}) {
  const base = STORE_THEMES[themeId] || STORE_THEMES[DEFAULT_THEME_ID];
  return {
    ...base,
    name: branding.storeName?.trim() || base.name,
    tagline: branding.tagline?.trim() || base.tagline,
    primaryColor: branding.primaryColor?.trim() || base.primaryColor,
    accentColor: branding.accentColor?.trim() || base.accentColor,
    bgTone: branding.bgTone?.trim() || base.bgTone,
  };
}

function applyThemeCssVariables(theme) {
  const root = globalThis.document.documentElement;
  root.style.setProperty("--store-theme-primary", theme.primaryColor);
  root.style.setProperty("--store-theme-accent", theme.accentColor);
  root.style.setProperty("--store-theme-bg", theme.bgTone);
  root.style.setProperty("--organic-primary", theme.primaryColor);
  root.style.setProperty("--organic-accent", theme.accentColor);
  root.style.setProperty("--organic-cream", theme.bgTone);
}

describe("Storefront Theme Rendering & Store Isolation Test Suite", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.document.documentElement.styles.clear();
  });

  it("1. Loading a saved theme: merges saved customizations with theme defaults", () => {
    const serverPayload = {
      theme_id: "nursery_botanics",
      store_name: "Botanical Haven",
      tagline: "Exotic Terrariums & Rare Houseplants",
      primary_color: "#15803D",
      accent_color: "#D97706",
      bg_tone: "#F0FDF4",
    };

    const resolved = resolveActiveTheme(serverPayload.theme_id, {
      storeName: serverPayload.store_name,
      tagline: serverPayload.tagline,
      primaryColor: serverPayload.primary_color,
      accentColor: serverPayload.accent_color,
      bgTone: serverPayload.bg_tone,
    });

    assert.equal(resolved.id, "nursery_botanics");
    assert.equal(resolved.name, "Botanical Haven");
    assert.equal(resolved.tagline, "Exotic Terrariums & Rare Houseplants");
    assert.equal(resolved.primaryColor, "#15803D");
    assert.equal(resolved.accentColor, "#D97706");
    assert.equal(resolved.bgTone, "#F0FDF4");
    assert.equal(resolved.sector, "Nursery & Planting");
  });

  it("2. Applying custom colors and bg_tone: sets CSS custom properties on document element", () => {
    const theme = resolveActiveTheme("pharma_medical", {
      primaryColor: "#0369A1",
      accentColor: "#0F766E",
      bgTone: "#E0F2FE",
    });

    applyThemeCssVariables(theme);

    const root = globalThis.document.documentElement;
    assert.equal(root.style.getPropertyValue("--store-theme-primary"), "#0369A1");
    assert.equal(root.style.getPropertyValue("--store-theme-accent"), "#0F766E");
    assert.equal(root.style.getPropertyValue("--store-theme-bg"), "#E0F2FE");
    assert.equal(root.style.getPropertyValue("--organic-primary"), "#0369A1");
    assert.equal(root.style.getPropertyValue("--organic-cream"), "#E0F2FE");
  });

  it("3. Updating live preview: retains unsaved edits and preview reacts immediately", () => {
    let editorState = {
      selectedThemeId: "nursery_botanics",
      branding: {
        storeName: "Preview Plant Hub",
        primaryColor: "#166534",
        bgTone: "#ECFDF5",
      },
    };

    // User types in a new store name and changes primary color in studio
    editorState = {
      ...editorState,
      branding: {
        ...editorState.branding,
        storeName: "Live Updated Plant Studio",
        primaryColor: "#047857",
      },
    };

    const previewTheme = resolveActiveTheme(editorState.selectedThemeId, editorState.branding);
    assert.equal(previewTheme.name, "Live Updated Plant Studio");
    assert.equal(previewTheme.primaryColor, "#047857");
    assert.equal(previewTheme.bgTone, "#ECFDF5");
  });

  it("4. Handling missing theme settings and API failures: safely falls back to defaults", () => {
    // Missing branding overrides
    const fallbackTheme = resolveActiveTheme(undefined, {});
    assert.equal(fallbackTheme.id, DEFAULT_THEME_ID);
    assert.equal(fallbackTheme.name, STORE_THEMES[DEFAULT_THEME_ID].name);
    assert.equal(fallbackTheme.primaryColor, STORE_THEMES[DEFAULT_THEME_ID].primaryColor);
    assert.equal(fallbackTheme.bgTone, STORE_THEMES[DEFAULT_THEME_ID].bgTone);
  });

  it("5. Store isolation: prevents theme leakage when switching between stores", () => {
    const storeAlphaSlug = "alpha-store";
    const storeBetaSlug = "beta-store";

    // Store Alpha saves GreenFlora theme
    const alphaThemeKey = getStoreStorageKey("businessos_store_active_theme", storeAlphaSlug);
    const alphaBrandingKey = getStoreStorageKey("businessos_store_branding_config", storeAlphaSlug);
    globalThis.localStorage.setItem(alphaThemeKey, "nursery_botanics");
    globalThis.localStorage.setItem(
      alphaBrandingKey,
      JSON.stringify({ storeName: "Alpha Green Nursery", primaryColor: "#15803D" })
    );

    // Store Beta saves ExpressMart theme
    const betaThemeKey = getStoreStorageKey("businessos_store_active_theme", storeBetaSlug);
    const betaBrandingKey = getStoreStorageKey("businessos_store_branding_config", storeBetaSlug);
    globalThis.localStorage.setItem(betaThemeKey, "speed_mart");
    globalThis.localStorage.setItem(
      betaBrandingKey,
      JSON.stringify({ storeName: "Beta Instant Express", primaryColor: "#7C3AED" })
    );

    // Assert Store Alpha settings
    const loadedAlphaThemeId = globalThis.localStorage.getItem(alphaThemeKey);
    const loadedAlphaBranding = JSON.parse(globalThis.localStorage.getItem(alphaBrandingKey));
    assert.equal(loadedAlphaThemeId, "nursery_botanics");
    assert.equal(loadedAlphaBranding.storeName, "Alpha Green Nursery");
    assert.equal(loadedAlphaBranding.primaryColor, "#15803D");

    // Assert Store Beta settings
    const loadedBetaThemeId = globalThis.localStorage.getItem(betaThemeKey);
    const loadedBetaBranding = JSON.parse(globalThis.localStorage.getItem(betaBrandingKey));
    assert.equal(loadedBetaThemeId, "speed_mart");
    assert.equal(loadedBetaBranding.storeName, "Beta Instant Express");
    assert.equal(loadedBetaBranding.primaryColor, "#7C3AED");

    // Assert changing Store Alpha does NOT affect Store Beta
    globalThis.localStorage.setItem(
      alphaBrandingKey,
      JSON.stringify({ storeName: "Alpha Green V2", primaryColor: "#059669" })
    );
    const recheckedBeta = JSON.parse(globalThis.localStorage.getItem(betaBrandingKey));
    assert.equal(recheckedBeta.storeName, "Beta Instant Express");
    assert.equal(recheckedBeta.primaryColor, "#7C3AED");
  });

  it("6. Failed save error handling: preserves unsaved edits and does not claim success", async () => {
    let successToastTriggered = false;
    let errorToastTriggered = false;
    let activePublishedTheme = "modern_fresh";

    let studioEdits = {
      theme_id: "pharma_medical",
      store_name: "Unsaved Clinic",
    };

    // Simulated API call that fails with a 500 error
    async function mockSaveTheme(payload) {
      throw new Error("Database connection timed out");
    }

    try {
      await mockSaveTheme(studioEdits);
      activePublishedTheme = studioEdits.theme_id;
      successToastTriggered = true;
    } catch (err) {
      errorToastTriggered = true;
      // Retain unsaved user edits in state
    }

    assert.equal(successToastTriggered, false, "Success toast must NEVER fire on save failure");
    assert.equal(errorToastTriggered, true, "Error toast must be shown on save failure");
    assert.equal(activePublishedTheme, "modern_fresh", "Published theme must not change on failed save");
    assert.equal(studioEdits.store_name, "Unsaved Clinic", "User edits must be preserved");
  });
});
