import React, { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ShoppingBag, Sparkles, ChevronRight, ChevronLeft,
  Truck, ShieldCheck, Award, Heart, Star, Check, Phone, ArrowUpRight,
  Search, Package, RotateCcw, LayoutGrid, Tag, ShoppingCart
} from "lucide-react";
import {
  organicCategories as fallbackCategories, organicProducts as fallbackProducts, organicBlogPosts, OrganicProduct
} from "@/data/mockOrganicData";
import { OrganicProductCard } from "@/components/storefront/organic/OrganicProductCard";
import { DynamicStoreHero, DynamicProductCard, DynamicStoreCategories } from "@/components/storefront/UniversalTemplateRouter";
import { fetchStorefrontProducts, fetchStorefrontCategories, mapStorefrontToOrganic } from "@/lib/storefront-api";
import { useCurrency } from "@/hooks/use-currency";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function StoreNotFound({ slug }: { slug?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center font-sans">
      <div className="size-20 rounded-3xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mb-6 shadow-sm">
        <Package className="size-10 stroke-[1.75]" />
      </div>
      <h1 className="text-3xl font-black text-gray-950 tracking-tight mb-2">
        Store Not Found
      </h1>
      <p className="text-sm text-gray-600 max-w-md leading-relaxed mb-6">
        {slug
          ? `The storefront "${slug}" could not be found or is currently unpublished by the merchant.`
          : "The requested storefront does not exist or has been taken offline."}
      </p>
      <Link
        to="/store"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer"
      >
        <ArrowRight className="size-4 rotate-180" /> Back to Marketplace Home
      </Link>
    </div>
  );
}

export const Route = createFileRoute("/store/")({
  component: LazyMonkeyStoreHome,
});

function LazyMonkeyStoreHome() {
  return <StorefrontHomeContent />;
}

export function StorefrontHomeContent({ dedicatedSlug }: { dedicatedSlug?: string }) {
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { addToCart } = useStoreCart();
  const { theme, branding, storeSlug, isStoreNotFound, getStoreUrl } = useStoreTheme();

  const effectiveSlug = dedicatedSlug || storeSlug || undefined;

  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const [activeCategoryTab, setActiveCategoryTab] = useState("All");
  const [memberEmail, setMemberEmail] = useState("");

  const effectiveStoreName = branding.storeName?.trim() || theme.name || "BusinessOS Store";
  const effectiveTagline = branding.tagline?.trim() || theme.tagline || "Hyperlocal Omnichannel Commerce";

  // Fetch live products scoped to store
  const { data: dynamicProductsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ["storefront-products-home", effectiveSlug],
    queryFn: () => fetchStorefrontProducts(undefined, undefined, undefined, 1, 50, effectiveSlug),
    staleTime: 60000,
  });

  const { data: dynamicCategoriesData } = useQuery({
    queryKey: ["storefront-categories-home", effectiveSlug],
    queryFn: () => fetchStorefrontCategories(undefined, effectiveSlug),
    staleTime: 60000,
  });

  if (isStoreNotFound) {
    return <StoreNotFound slug={effectiveSlug} />;
  }

  // Real inventory products from backend
  const liveItems: OrganicProduct[] = (dynamicProductsData?.items || []).map((p, i) => mapStorefrontToOrganic(p, i));
  const combinedProducts: OrganicProduct[] = liveItems.length > 0 ? liveItems : fallbackProducts;

  // Render categories derived directly from live database categories / products
  const categoriesList = React.useMemo(() => {
    if (dynamicCategoriesData && dynamicCategoriesData.length > 0) {
      return dynamicCategoriesData.map((c, i) => ({
        id: c.id,
        name: c.name,
        slug: c.name.toLowerCase().replace(/\s+/g, "-"),
        image: c.image_url || fallbackCategories[i % fallbackCategories.length]?.image || "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=200&q=80",
        itemCount: c.item_count || combinedProducts.filter(p => p.category?.toLowerCase() === c.name.toLowerCase()).length || 0,
      }));
    }
    if (liveItems.length > 0) {
      const distinctCats = Array.from(new Set(liveItems.map(p => p.category || p.brand).filter(Boolean)));
      return distinctCats.map((cat, i) => ({
        id: `cat-${i}`,
        name: String(cat),
        slug: String(cat).toLowerCase().replace(/\s+/g, "-"),
        image: fallbackCategories[i % fallbackCategories.length]?.image || "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=200&q=80",
        itemCount: liveItems.filter(p => (p.category || p.brand) === cat).length,
      }));
    }
    return fallbackCategories;
  }, [dynamicCategoriesData, liveItems, combinedProducts]);

  // Dynamic category tabs derived from actual product categories
  const dynamicCategoryTabs = React.useMemo(() => {
    const cats = new Set<string>();
    combinedProducts.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return ["All", ...Array.from(cats).slice(0, 5)];
  }, [combinedProducts]);

  const filteredBestSellers = combinedProducts.filter((p) => {
    if (activeCategoryTab === "All") return true;
    return p.category?.toLowerCase() === activeCategoryTab.toLowerCase();
  });

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroSearchQuery.trim()) return;
    navigate({
      to: "/store/shop",
      search: { search: heroSearchQuery.trim(), ...(effectiveSlug ? { store: effectiveSlug } : {}) } as any,
    });
  };

  const handleMemberSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail || !memberEmail.includes("@")) {
      return toast.error("Please enter a valid email address.");
    }
    toast.success(`Welcome to ${effectiveStoreName}! Coupon code MEMBER20 has been applied.`);
    navigate({
      to: "/store/shop",
      search: effectiveSlug ? ({ store: effectiveSlug } as any) : undefined,
    });
  };

  const handleQuickAdd = (id: string, name: string, price: number, image: string) => {
    addToCart({
      id,
      name,
      price,
      image_url: image,
    }, 1);
    toast.success(`Added ${name} to cart!`);
  };

  return (
    <div
      className="w-full font-sans pb-12 overflow-x-hidden transition-colors duration-300"
      style={{ backgroundColor: theme.bgTone }}
    >
      
      {/* ── 1. Dynamic Hero Section ── */}
      <DynamicStoreHero
        fallbackHero={
          <section className="relative w-full bg-gradient-to-b from-white/60 via-transparent to-transparent border-b border-gray-100/80 py-10 lg:py-16 overflow-hidden">
            {/* Soft background ambient glows */}
            <div
              className="absolute -left-20 top-20 size-80 rounded-full blur-3xl pointer-events-none opacity-20"
              style={{ backgroundColor: theme.primaryColor }}
            />
            <div
              className="absolute right-10 top-10 size-96 rounded-full blur-3xl pointer-events-none opacity-15"
              style={{ backgroundColor: theme.accentColor }}
            />

            <div className="container mx-auto px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">
                
                {/* ── Left Column: Headline, Search & CTAs ── */}
                <div className="lg:col-span-6 space-y-6 text-left">
                  
                  {/* Badge Pill */}
                  <div
                    className="inline-flex items-center gap-2 border px-3.5 py-1.5 rounded-full shadow-2xs"
                    style={{
                      backgroundColor: `${theme.primaryColor}12`,
                      borderColor: `${theme.primaryColor}30`,
                    }}
                  >
                    <Sparkles className="size-3.5" style={{ color: theme.primaryColor }} />
                    <span className="text-xs font-bold" style={{ color: theme.primaryColor }}>
                      Shop Smarter with {effectiveStoreName}
                    </span>
                  </div>

                  {/* Main Headline */}
                  <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-gray-950 leading-[1.08] tracking-tight font-sans">
                    Everything You Need.<br />
                    <span className="relative inline-block mt-1" style={{ color: theme.primaryColor }}>
                      All in One Place.
                      <span
                        className="absolute -bottom-1.5 left-0 w-full h-3 rounded-full -z-10 opacity-20"
                        style={{ backgroundColor: theme.primaryColor }}
                      />
                    </span>
                  </h1>

                  {/* Description paragraph */}
                  <p className="text-sm sm:text-base text-gray-600 max-w-xl leading-relaxed">
                    Discover a wide range of curated products across all categories — all at direct supplier prices, powered by {effectiveStoreName}.
                  </p>

                  {/* Search Bar Container */}
                  <form
                    onSubmit={handleHeroSearch}
                    className="flex items-center bg-white border border-gray-200/90 rounded-full p-1.5 pl-4 max-w-xl shadow-md hover:border-gray-300 focus-within:ring-2 focus-within:ring-black/5 transition-all"
                  >
                    <Search className="size-4.5 text-gray-400 shrink-0 mr-2.5" />
                    <input
                      type="text"
                      placeholder="Search for products, brands, or categories..."
                      value={heroSearchQuery}
                      onChange={(e) => setHeroSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-xs sm:text-sm text-gray-800 outline-none placeholder:text-gray-400"
                    />
                    <button
                      type="submit"
                      className="text-white font-bold text-xs sm:text-sm px-6 py-2.5 sm:py-3 rounded-full transition-opacity hover:opacity-90 cursor-pointer shadow-sm shrink-0"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      Search
                    </button>
                  </form>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3.5 pt-1">
                    <Link
                      to="/store/shop"
                      search={effectiveSlug ? ({ store: effectiveSlug } as any) : undefined}
                      className="text-white font-bold text-sm px-7 py-3.5 rounded-full transition-all shadow-md hover:shadow-lg flex items-center gap-2 group"
                      style={{ backgroundColor: theme.primaryColor }}
                    >
                      <ShoppingCart className="size-4" />
                      <span>Shop Now</span>
                      <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("categories-section");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-sm px-7 py-3.5 rounded-full transition-all shadow-2xs cursor-pointer"
                    >
                      Explore Categories
                    </button>
                  </div>

                  {/* 4 Feature Trust Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-gray-100 max-w-xl">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                      >
                        <Truck className="size-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-900 leading-tight">Fast Delivery</span>
                        <span className="block text-[10px] text-gray-500">At your doorstep</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                      >
                        <ShieldCheck className="size-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-900 leading-tight">Secure Payments</span>
                        <span className="block text-[10px] text-gray-500">100% safe & secure</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                      >
                        <RotateCcw className="size-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-900 leading-tight">Easy Returns</span>
                        <span className="block text-[10px] text-gray-500">Hassle free</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div
                        className="size-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}
                      >
                        <LayoutGrid className="size-4" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-900 leading-tight">Wide Selection</span>
                        <span className="block text-[10px] text-gray-500">1000+ brands</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── Right Column: High-Res 3D Showcase Graphic ── */}
                <div className="lg:col-span-6 relative flex items-center justify-center">
                  <div className="relative w-full max-w-[620px] transition-transform duration-500 hover:scale-[1.02]">
                    <img
                      src="/hero-showcase.jpg"
                      alt={`${effectiveStoreName} - All in One Place`}
                      className="w-full h-auto object-contain drop-shadow-2xl select-none"
                      loading="eager"
                    />
                  </div>
                </div>

              </div>
            </div>
          </section>
        }
      />

      {/* ── 2. Dynamic Category Section ── */}
      <DynamicStoreCategories
        categories={categoriesList}
        onSelectCategory={(cat) => {
          navigate({
            to: "/store/shop",
            search: { category: cat.name, ...(effectiveSlug ? { store: effectiveSlug } : {}) } as any,
          });
        }}
      />

      {/* ── 3. Best Selling Products Section with Category Tabs ── */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight font-sans">
                Best Selling Products
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Top-rated customer favorites and everyday essentials</p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl border border-gray-200">
              {dynamicCategoryTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveCategoryTab(tab)}
                  style={activeCategoryTab === tab ? { backgroundColor: theme.primaryColor, color: "#fff" } : undefined}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    activeCategoryTab !== tab && "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredBestSellers.slice(0, 8).map((product) => (
              <DynamicProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Promo Banners Grid ── */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Banner 1 */}
            <div
              onClick={() => navigate({ to: "/store/shop", search: { filter: "sale", ...(effectiveSlug ? { store: effectiveSlug } : {}) } as any })}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50/80 p-8 border border-amber-100 shadow-xs cursor-pointer hover:shadow-md transition-all"
            >
              <div className="relative z-10 space-y-3 max-w-[65%]">
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white uppercase tracking-wider"
                  style={{ backgroundColor: theme.accentColor || "#F97316" }}
                >
                  Weekly Deals
                </span>
                <h3 className="text-2xl font-black text-gray-900 font-sans leading-tight">
                  Items on SALE
                </h3>
                <p className="text-xs text-gray-600 font-semibold">Discounts up to 40%</p>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-transform"
                  style={{ color: theme.primaryColor }}
                >
                  Shop Now <ArrowRight className="size-3.5" />
                </span>
              </div>
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80"
                alt="Items on Sale"
                className="absolute -right-4 -bottom-4 w-36 h-36 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-md"
              />
            </div>

            {/* Banner 2 */}
            <div
              onClick={() => navigate({ to: "/store/shop", search: { filter: "combo", ...(effectiveSlug ? { store: effectiveSlug } : {}) } as any })}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 p-8 border border-emerald-100 shadow-xs cursor-pointer hover:shadow-md transition-all"
            >
              <div className="relative z-10 space-y-3 max-w-[65%]">
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white uppercase tracking-wider"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Bundle & Save
                </span>
                <h3 className="text-2xl font-black text-gray-900 font-sans leading-tight">
                  Combo Offers
                </h3>
                <p className="text-xs text-gray-600 font-semibold">Save up to 50% on bundles</p>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-transform"
                  style={{ color: theme.primaryColor }}
                >
                  Explore Combos <ArrowRight className="size-3.5" />
                </span>
              </div>
              <img
                src="https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300&q=80"
                alt="Combo Offers"
                className="absolute -right-4 -bottom-4 w-36 h-36 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-md"
              />
            </div>

            {/* Banner 3 */}
            <div
              onClick={() => navigate({ to: "/store/shop", search: { filter: "coupons", ...(effectiveSlug ? { store: effectiveSlug } : {}) } as any })}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-50 to-indigo-50 p-8 border border-purple-100 shadow-xs cursor-pointer hover:shadow-md transition-all"
            >
              <div className="relative z-10 space-y-3 max-w-[65%]">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900 text-white uppercase tracking-wider">
                  Vouchers
                </span>
                <h3 className="text-2xl font-black text-gray-900 font-sans leading-tight">
                  Special Coupons
                </h3>
                <p className="text-xs text-gray-600 font-semibold">Extra 20% on first order</p>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-transform"
                  style={{ color: theme.primaryColor }}
                >
                  Claim Voucher <ArrowRight className="size-3.5" />
                </span>
              </div>
              <img
                src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&q=80"
                alt="Special Coupons"
                className="absolute -right-4 -bottom-4 w-36 h-36 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Member Privilege Banner ── */}
      <section className="py-10">
        <div className="container mx-auto px-4">
          <div
            className="relative overflow-hidden rounded-3xl text-white p-8 md:p-14 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8 transition-colors"
            style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor || theme.primaryColor})` }}
          >
            <div className="relative z-10 max-w-xl space-y-2 text-center md:text-left">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-white/20 uppercase tracking-widest text-white">
                Member Privilege
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Get 20% Discount on your first purchase
              </h2>
              <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                Join {effectiveStoreName} today to enjoy member flash prices, priority express delivery, and instant rewards.
              </p>
            </div>

            <form
              onSubmit={handleMemberSignup}
              className="relative z-10 w-full md:w-auto flex flex-col sm:flex-row gap-2.5 max-w-md"
            >
              <input
                type="email"
                required
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="Enter your email address..."
                className="px-5 py-3.5 rounded-full text-xs font-medium text-gray-900 bg-white placeholder:text-gray-400 outline-none w-full sm:w-72 shadow-sm"
              />
              <button
                type="submit"
                className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-7 py-3.5 rounded-full transition-colors shrink-0 shadow-md cursor-pointer"
              >
                Register
              </button>
            </form>
          </div>
        </div>
      </section>

    </div>
  );
}
