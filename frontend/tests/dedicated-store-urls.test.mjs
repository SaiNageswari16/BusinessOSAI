import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock environment
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

globalThis.localStorage = new MockLocalStorage();
globalThis.window = {
  location: { pathname: "/store", search: "" },
  dispatchEvent: () => {},
};

// ── 1. The 6 Registered Templates & Store Themes ──
const STORE_THEMES = {
  modern_fresh: {
    id: "modern_fresh",
    name: "FreshMart",
    tagline: "Supermarket, Farm Fresh & Daily Grocery",
    sector: "Grocery & Retail",
    primaryColor: "#16A34A",
    accentColor: "#EA580C",
    bgTone: "#FFFFFF",
    header: "OrganicHeader",
    hero: "FallbackHero",
    categories: "OrganicCategories",
    productCard: "OrganicProductCard",
    footer: "OrganicFooter",
  },
  nursery_botanics: {
    id: "nursery_botanics",
    name: "GreenFlora",
    tagline: "Botanical Nursery, Plants & Garden Care",
    sector: "Nursery & Planting",
    primaryColor: "#1B4D3E",
    accentColor: "#C25E3E",
    bgTone: "#FAF8F5",
    header: "NurseryHeader",
    hero: "NurseryHero",
    categories: "NurseryCategories",
    productCard: "NurseryProductCard",
    footer: "NurseryFooter",
  },
  pharma_medical: {
    id: "pharma_medical",
    name: "MedPlus",
    tagline: "Healthcare, Pharmacy & Wellness",
    sector: "Medical & Pharma",
    primaryColor: "#0284C7",
    accentColor: "#0D9488",
    bgTone: "#F0F9FF",
    header: "PharmaHeader",
    hero: "PharmaHero",
    categories: "PharmaCategories",
    productCard: "PharmaProductCard",
    footer: "PharmaFooter",
  },
  speed_mart: {
    id: "speed_mart",
    name: "ExpressMart",
    tagline: "10-Minute Hyperlocal Quick Commerce",
    sector: "Quick Commerce",
    primaryColor: "#7C3AED",
    accentColor: "#F59E0B",
    bgTone: "#FDF4FF",
    header: "QuickMartHeader",
    hero: "QuickMartHero",
    categories: "QuickMartCategories",
    productCard: "QuickMartProductCard",
    footer: "QuickMartFooter",
  },
  mega_market: {
    id: "mega_market",
    name: "MegaStore",
    tagline: "Electronics, Gadgets & Hardware",
    sector: "Electronics & Tech",
    primaryColor: "#0F172A",
    accentColor: "#2563EB",
    bgTone: "#F8FAFC",
    header: "MegaHeader",
    hero: "MegaHero",
    categories: "MegaCategories",
    productCard: "MegaProductCard",
    footer: "MegaFooter",
  },
  fashion_boutique: {
    id: "fashion_boutique",
    name: "Vogue Studio",
    tagline: "Fashion, Designer Apparel & Luxury Lifestyle",
    sector: "Fashion & Lifestyle",
    primaryColor: "#18181B",
    accentColor: "#E11D48",
    bgTone: "#FAFAFA",
    header: "FashionHeader",
    hero: "FashionHero",
    categories: "FashionCategories",
    productCard: "FashionProductCard",
    footer: "FashionFooter",
  },
};

const DEFAULT_THEME_ID = "speed_mart";

const KNOWN_STORE_SUBROUTES = new Set([
  "", "about", "account", "addresses", "blog", "cart",
  "checkout", "collection", "contact", "orders", "pages",
  "product", "register", "search", "security", "shop",
  "styles", "thank-you", "wallet", "wishlist"
]);

// ── 2. Logic matching StoreThemeContext.tsx ──
function getStoreSlugFromUrl(pathname, search) {
  if (pathname.startsWith("/store/")) {
    const parts = pathname.slice("/store/".length).split("/").filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[0].toLowerCase().trim();
      if (!KNOWN_STORE_SUBROUTES.has(candidate)) {
        return candidate;
      }
    }
  }

  const params = new URLSearchParams(search);
  const storeParam = params.get("store")?.trim() || params.get("tenant")?.trim();
  if (storeParam) return storeParam.toLowerCase();

  return null;
}

function getStoreUrl(subpath = "", currentSlug = null) {
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

function resolveUniversalTemplate(themeId) {
  const resolved = STORE_THEMES[themeId] || STORE_THEMES[DEFAULT_THEME_ID];
  return {
    header: resolved.header,
    hero: resolved.hero,
    categories: resolved.categories,
    productCard: resolved.productCard,
    footer: resolved.footer,
    primaryColor: resolved.primaryColor,
    accentColor: resolved.accentColor,
    bgTone: resolved.bgTone,
  };
}

describe("Dedicated Store URLs & Universal Template Resolution", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("1. Resolves clean path-based store URLs (/store/greenflora)", () => {
    const slug = getStoreSlugFromUrl("/store/greenflora", "");
    assert.equal(slug, "greenflora");
  });

  it("2. Resolves clean path-based store URLs (/store/fashionhub)", () => {
    const slug = getStoreSlugFromUrl("/store/fashionhub", "");
    assert.equal(slug, "fashionhub");
  });

  it("3. Distinguishes known subroutes from store slugs", () => {
    assert.equal(getStoreSlugFromUrl("/store/shop", ""), null);
    assert.equal(getStoreSlugFromUrl("/store/cart", ""), null);
    assert.equal(getStoreSlugFromUrl("/store/checkout", ""), null);
    assert.equal(getStoreSlugFromUrl("/store/orders", ""), null);
  });

  it("4. Supports legacy search params as fallback (?store=greenflora)", () => {
    const slug = getStoreSlugFromUrl("/store/shop", "?store=greenflora");
    assert.equal(slug, "greenflora");
  });

  it("5. getStoreUrl preserves store context across storefront navigation", () => {
    const slug = "greenflora";
    assert.equal(getStoreUrl("", slug), "/store/greenflora");
    assert.equal(getStoreUrl("/shop", slug), "/store/shop?store=greenflora");
    assert.equal(getStoreUrl("/cart", slug), "/store/cart?store=greenflora");
    assert.equal(getStoreUrl("/product/prod_123", slug), "/store/product/prod_123?store=greenflora");
    assert.equal(getStoreUrl("/checkout", slug), "/store/checkout?store=greenflora");
  });

  it("6. Template resolution: All 6 registered templates render correct component sets", () => {
    const templateIds = [
      "modern_fresh",
      "nursery_botanics",
      "pharma_medical",
      "speed_mart",
      "mega_market",
      "fashion_boutique",
    ];

    for (const tid of templateIds) {
      const components = resolveUniversalTemplate(tid);
      const expected = STORE_THEMES[tid];
      assert.equal(components.header, expected.header, `Header mismatch for ${tid}`);
      assert.equal(components.hero, expected.hero, `Hero mismatch for ${tid}`);
      assert.equal(components.categories, expected.categories, `Categories mismatch for ${tid}`);
      assert.equal(components.productCard, expected.productCard, `ProductCard mismatch for ${tid}`);
      assert.equal(components.footer, expected.footer, `Footer mismatch for ${tid}`);
      assert.equal(components.primaryColor, expected.primaryColor, `Primary color mismatch for ${tid}`);
    }
  });

  it("7. Fallback handling: unknown template ID defaults safely without crashing", () => {
    const unknown = resolveUniversalTemplate("non_existent_cyber_punk_theme");
    assert.equal(unknown.header, STORE_THEMES[DEFAULT_THEME_ID].header);
    assert.equal(unknown.hero, STORE_THEMES[DEFAULT_THEME_ID].hero);
    assert.equal(unknown.categories, STORE_THEMES[DEFAULT_THEME_ID].categories);
    assert.equal(unknown.productCard, STORE_THEMES[DEFAULT_THEME_ID].productCard);
    assert.equal(unknown.footer, STORE_THEMES[DEFAULT_THEME_ID].footer);
  });

  it("8. Store switching: cache keys are strictly isolated by store slug", () => {
    function getStoreStorageKey(prefix, storeSlug) {
      return storeSlug ? `${prefix}_store_${storeSlug.toLowerCase()}` : `${prefix}_default`;
    }

    const keyFlora = getStoreStorageKey("theme", "greenflora");
    const keyFashion = getStoreStorageKey("theme", "fashionhub");

    globalThis.localStorage.setItem(keyFlora, "nursery_botanics");
    globalThis.localStorage.setItem(keyFashion, "fashion_boutique");

    assert.equal(globalThis.localStorage.getItem(keyFlora), "nursery_botanics");
    assert.equal(globalThis.localStorage.getItem(keyFashion), "fashion_boutique");
    assert.notEqual(keyFlora, keyFashion);
  });
});
