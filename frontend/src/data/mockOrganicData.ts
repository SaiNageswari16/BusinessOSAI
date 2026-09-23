export interface OrganicProduct {
  id: string;
  name: string;
  category: string;
  image: string;
  price: number;
  originalPrice: number;
  discountBadge?: string;
  rating: number;
  reviewsCount: number;
  unit: string;
  description: string;
  badge?: string;
  inStock: boolean;
  featured?: boolean;
  popular?: boolean;
  brand?: string;
  sku?: string;
  sellerName?: string;
}

export interface OrganicCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  itemCount: number;
  iconName?: string;
}

export interface OrganicBlogPost {
  id: string;
  title: string;
  slug: string;
  date: string;
  category: string;
  image: string;
  excerpt: string;
  author: string;
}

export const organicCategories: OrganicCategory[] = [
  { id: "cat-1", name: "Electronics", slug: "electronics", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=60", itemCount: 142 },
  { id: "cat-2", name: "Fashion", slug: "fashion", image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=60", itemCount: 286 },
  { id: "cat-3", name: "Home & Kitchen", slug: "home-kitchen", image: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=500&auto=format&fit=crop&q=60", itemCount: 195 },
  { id: "cat-4", name: "Beauty & Personal", slug: "beauty-personal", image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500&auto=format&fit=crop&q=60", itemCount: 164 },
  { id: "cat-5", name: "Groceries & Staples", slug: "groceries-staples", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60", itemCount: 353 },
  { id: "cat-6", name: "POS & Billing Hardware", slug: "pos-billing-hardware", image: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=500&auto=format&fit=crop&q=60", itemCount: 78 },
  { id: "cat-7", name: "Footwear & Sports", slug: "footwear-sports", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60", itemCount: 120 },
  { id: "cat-8", name: "Smart Devices & Audio", slug: "smart-devices-audio", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60", itemCount: 92 },
];

export const organicProducts: OrganicProduct[] = [
  {
    id: "prod-laptop",
    name: "Laptop Pro 14\" M3 Max (32GB RAM, 1TB SSD)",
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=80",
    price: 54999.0,
    originalPrice: 69999.0,
    discountBadge: "21% OFF",
    rating: 4.8,
    reviewsCount: 1240,
    unit: "1 Unit",
    description: "Ultra-fast Next-Gen processing power with Liquid Retina XDR display, 18-hour all-day battery life, and high-performance neural compute architecture.",
    brand: "TechPro",
    sku: "LAP-PRO-14",
    featured: true,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-shoes",
    name: "Ultra Cushion Breathable Running Shoes",
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=80",
    price: 2499.0,
    originalPrice: 3999.0,
    discountBadge: "37% OFF",
    rating: 4.6,
    reviewsCount: 892,
    unit: "Pair",
    description: "Lightweight, responsive foam midsole running shoes designed for marathon endurance, daily morning training, and active lifestyle comfort.",
    brand: "StrideFlex",
    sku: "SHOE-RUN-WHT",
    featured: true,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-airfryer",
    name: "Digital Touchscreen Air Fryer 5.5L Rapid Heat",
    category: "Home & Kitchen",
    image: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=500&auto=format&fit=crop&q=80",
    price: 4999.0,
    originalPrice: 7999.0,
    discountBadge: "38% OFF",
    rating: 4.7,
    reviewsCount: 651,
    unit: "1 Unit",
    description: "360-degree rapid cyclonic hot air circulation for crispy, oil-free healthy cooking with 8 one-touch cooking presets and non-stick basket.",
    brand: "ChefMaster",
    sku: "KIT-AF-55L",
    featured: true,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-perfume",
    name: "Premium Eau de Parfum Luxury Amber Rose 100ml",
    category: "Beauty & Personal",
    image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500&auto=format&fit=crop&q=80",
    price: 1999.0,
    originalPrice: 3499.0,
    discountBadge: "43% OFF",
    rating: 4.5,
    reviewsCount: 420,
    unit: "100ml Bottle",
    description: "Exquisite long-lasting artisan fragrance combining velvety Bulgarian rose, rich Moroccan amber, and golden vanilla undertones.",
    brand: "Maison Luxe",
    sku: "BTY-PERF-100",
    featured: true,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-atta",
    name: "Aashirvaad Superior Sharbati Atta 5kg",
    category: "Groceries & Staples",
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80",
    price: 285.0,
    originalPrice: 340.0,
    discountBadge: "16% OFF",
    rating: 4.7,
    reviewsCount: 2150,
    unit: "5kg Pack",
    description: "100% MP Sharbati whole wheat grains ground to perfection using traditional stone-ground chakki process for ultra-soft, golden rotis.",
    brand: "Aashirvaad",
    sku: "GROC-ATTA-5KG",
    featured: true,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-headphones",
    name: "Noise-Cancelling Wireless Over-Ear Headphones",
    category: "Smart Devices & Audio",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80",
    price: 3499.0,
    originalPrice: 5999.0,
    discountBadge: "42% OFF",
    rating: 4.8,
    reviewsCount: 1540,
    unit: "1 Set",
    description: "Active hybrid noise cancellation with 40mm titanium drivers, 40-hour ultra-long battery playback, and crystal clear multipoint handsfree calling.",
    brand: "SoundWave Pro",
    sku: "AUD-HDPH-NC",
    featured: true,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-pos1",
    name: "LazyMonkey Smart Android POS Terminal Pro",
    category: "POS & Billing Hardware",
    image: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=500&auto=format&fit=crop&q=80",
    price: 12499.0,
    originalPrice: 15999.0,
    discountBadge: "22% OFF",
    rating: 4.9,
    reviewsCount: 312,
    unit: "1 Complete Kit",
    description: "High-performance enterprise Android POS terminal featuring 5.5-inch HD touchscreen, built-in 58mm high-speed thermal printer, and full billing suite.",
    brand: "LazyMonkey Hardware",
    sku: "LM-POS-T1",
    featured: true,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-smartwatch",
    name: "Amoled Display Fitness Smartwatch with GPS",
    category: "Smart Devices & Audio",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80",
    price: 2999.0,
    originalPrice: 4999.0,
    discountBadge: "40% OFF",
    rating: 4.7,
    reviewsCount: 780,
    unit: "1 Unit",
    description: "Always-On 1.43-inch AMOLED display with continuous heart-rate and SpO2 tracking, 110+ sports modes, and 12-day battery life.",
    brand: "PulseTech",
    sku: "DEV-WATCH-PRO",
    featured: false,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-paper",
    name: "Premium 80mm Thermal Billing Rolls (Pack of 24)",
    category: "POS & Billing Hardware",
    image: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&auto=format&fit=crop&q=80",
    price: 1150.0,
    originalPrice: 1450.0,
    discountBadge: "21% OFF",
    rating: 4.8,
    reviewsCount: 410,
    unit: "Pack of 24 Rolls",
    description: "BPA-free premium grade 80mm x 50m high-density thermal paper with 5-year legibility guarantee.",
    brand: "PaperMaster Pro",
    sku: "PPR-80MM-PK24",
    featured: false,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-scanner",
    name: "Wireless 2D/1D Barcode & QR Scanner with Stand",
    category: "POS & Billing Hardware",
    image: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=80",
    price: 2450.0,
    originalPrice: 3200.0,
    discountBadge: "23% OFF",
    rating: 4.9,
    reviewsCount: 228,
    unit: "1 Set with Cradle",
    description: "Industrial-grade CMOS 2.4G wireless and Bluetooth barcode reader with 100m range.",
    brand: "ScanPro Enterprise",
    sku: "SCN-2D-WLS",
    featured: false,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-coffee",
    name: "Roasted Arabica Coffee Beans 1kg Commercial Pack",
    category: "Groceries & Staples",
    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=500&auto=format&fit=crop&q=80",
    price: 1350.0,
    originalPrice: 1700.0,
    discountBadge: "21% OFF",
    rating: 4.9,
    reviewsCount: 395,
    unit: "1 kg Bag",
    description: "Premium single-estate medium roast 100% Arabica whole coffee beans with rich chocolate and hazelnut tasting notes.",
    brand: "CaféBlend Wholesale",
    sku: "FMCG-COF-1KG",
    featured: false,
    popular: true,
    inStock: true,
  },
  {
    id: "prod-water",
    name: "Commercial Natural Mineral Water 500ml (Case of 24)",
    category: "Groceries & Staples",
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=80",
    price: 480.0,
    originalPrice: 600.0,
    discountBadge: "20% OFF",
    rating: 4.7,
    reviewsCount: 520,
    unit: "Case (24 Bottles)",
    description: "Pure mountain spring bottled water with balanced electrolytes and mineral composition.",
    brand: "AquaPure",
    sku: "BEV-H2O-24CS",
    featured: false,
    popular: true,
    inStock: true,
  }
];

export const organicBlogPosts: OrganicBlogPost[] = [
  {
    id: "blog-1",
    title: "10 Smart Shopping Hacks to Save Big on Electronics & Tech in 2026",
    slug: "smart-shopping-hacks-electronics",
    date: "12 Sep 2026",
    category: "Shopping Guide",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=80",
    author: "LazyMonkey Shopping Desk",
    excerpt: "Learn how to combine member coin rewards, seasonal flash vouchers, and bundled combos to maximize your savings.",
  },
  {
    id: "blog-2",
    title: "Top Kitchen Appliances That Will Transform Your Healthy Cooking Routine",
    slug: "top-kitchen-appliances-healthy-cooking",
    date: "18 Sep 2026",
    category: "Home & Lifestyle",
    image: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=500&auto=format&fit=crop&q=80",
    author: "Culinary Insights",
    excerpt: "From rapid heat air fryers to cold press juicers, explore the best kitchen tech for hassle-free everyday meals.",
  },
  {
    id: "blog-3",
    title: "Fast-Track Fulfillment: How LazyMonkeyAI Delivers Doorstep Speed",
    slug: "fast-track-fulfillment-speed",
    date: "25 Sep 2026",
    category: "Tech & Logistics",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80",
    author: "Logistics Team",
    excerpt: "An inside look at our AI-powered warehouse distribution and priority courier dispatch network.",
  }
];

export const organicNavigationMenu = [
  { label: "Home", href: "/store" },
  { label: "Shop", href: "/store/shop" },
  { label: "Categories", href: "/store/shop" },
  { label: "Offers", href: "/store/shop?filter=sale" },
  { label: "Orders", href: "/store/orders" },
  { label: "Help", href: "/store/contact" },
];
