export interface StoreThemeConfig {
  id: string;
  name: string;
  tagline: string;
  sector: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  bgTone: string;
  badgeText: string;
  fontFamily: string;
  icon: string;
  keywords: string[];
}

export const STORE_THEMES: Record<string, StoreThemeConfig> = {
  nursery_botanics: {
    id: "nursery_botanics",
    name: "GreenFlora",
    tagline: "Botanical Nursery, Plants & Garden Care",
    sector: "Nursery & Planting",
    description: "Earthy terracotta & botanical forest aesthetic with sunlight/watering care guides, pot sizes, and air-purifying plant badges.",
    primaryColor: "#1B4D3E", // Deep forest green
    accentColor: "#C25E3E",  // Warm terracotta
    bgTone: "#FAF8F5",       // Organic linen cream
    badgeText: "🌿 Botanical Nursery",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    icon: "Sprout",
    keywords: ["Plants", "Indoor Botanicals", "Ceramic Pots", "Gardening Tools", "Organic Fertilizers", "Seeds"],
  },
  pharma_medical: {
    id: "pharma_medical",
    name: "MedPlus",
    tagline: "Healthcare, Pharmacy & Wellness",
    sector: "Medical & Pharma",
    description: "Clinical teal & surgical blue interface with Rx badges, salt composition, dosage packs, and verified chemist audit guarantees.",
    primaryColor: "#0284C7", // Medical sky blue
    accentColor: "#0D9488",  // Clean clinical teal
    bgTone: "#F0F9FF",       // Sterilized cool white
    badgeText: "💊 Certified Pharmacy",
    fontFamily: "'Inter', sans-serif",
    icon: "Pill",
    keywords: ["Medicines", "Health Supplements", "Ayurveda", "Medical Devices", "Personal Care", "First Aid"],
  },
  modern_fresh: {
    id: "modern_fresh",
    name: "FreshMart",
    tagline: "Supermarket, Farm Fresh & Daily Grocery",
    sector: "Grocery & Retail",
    description: "Lively organic greens & freshness badges with weight selectors, farm-to-table guarantees, and promotional discount ribbons.",
    primaryColor: "#16A34A", // Emerald green
    accentColor: "#EA580C",  // Vibrant orange
    bgTone: "#FFFFFF",
    badgeText: "🛒 Fresh Supermarket",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    icon: "Apple",
    keywords: ["Fresh Vegetables", "Dairy & Eggs", "Farm Fruits", "Bakery", "Beverages", "Snacks"],
  },
  fashion_boutique: {
    id: "fashion_boutique",
    name: "Vogue Studio",
    tagline: "Fashion, Designer Apparel & Luxury Lifestyle",
    sector: "Fashion & Lifestyle",
    description: "High-fashion minimalist look with editorial lookbooks, live color swatches, size pickers, and smooth drawer carts.",
    primaryColor: "#18181B", // Zinc obsidian
    accentColor: "#E11D48",  // Rose accent
    bgTone: "#FAFAFA",
    badgeText: "👗 Haute Boutique",
    fontFamily: "'Playfair Display', serif",
    icon: "Sparkles",
    keywords: ["New Arrivals", "Women", "Men", "Footwear", "Accessories", "Jewelry"],
  },
  mega_market: {
    id: "mega_market",
    name: "MegaStore",
    tagline: "Electronics, Gadgets, Multi-Category & Hardware",
    sector: "Electronics & Tech",
    description: "Amazon/BestBuy-style high-density catalog with technical spec badges, star ratings, left-side category filter rail, and instant buy.",
    primaryColor: "#0F172A", // Slate navy
    accentColor: "#2563EB",  // Electric blue
    bgTone: "#F8FAFC",
    badgeText: "⚡ Tech Hypermarket",
    fontFamily: "'Inter', sans-serif",
    icon: "Laptop",
    keywords: ["Electronics", "Laptops", "Audio & Headphones", "Smart Gadgets", "Gaming", "Accessories"],
  },
  speed_mart: {
    id: "speed_mart",
    name: "ExpressMart",
    tagline: "10-Minute Hyperlocal Quick Commerce",
    sector: "Quick Commerce",
    description: "Blinkit/Zepto-style mobile-first ordering with instant [- 1 +] stepper buttons, sticky category tabs, and floating bottom cart bar.",
    primaryColor: "#7C3AED", // Vibrant violet
    accentColor: "#F59E0B",  // Lightning amber
    bgTone: "#FDF4FF",
    badgeText: "🚀 10-Min Express",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    icon: "Zap",
    keywords: ["Quick Bites", "Cold Drinks", "Dairy & Bread", "Instant Foods", "Household", "Personal Care"],
  },
};

export const DEFAULT_THEME_ID = "nursery_botanics";
