import React, { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ShoppingBag, Sparkles, ChevronRight, ChevronLeft,
  Truck, ShieldCheck, Award, Heart, Star, Check, Phone, ArrowUpRight
} from "lucide-react";
import {
  organicCategories as fallbackCategories, organicProducts as fallbackProducts, organicBlogPosts, OrganicProduct
} from "@/data/mockOrganicData";
import { OrganicProductCard } from "@/components/storefront/organic/OrganicProductCard";
import { fetchStorefrontProducts, fetchStorefrontCategories, mapStorefrontToOrganic } from "@/lib/storefront-api";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/")({
  component: OrganicStoreHome,
});

function OrganicStoreHome() {
  const navigate = useNavigate();
  const { currency } = useCurrency();

  const [activeCategoryTab, setActiveCategoryTab] = useState("All");
  const [memberEmail, setMemberEmail] = useState("");

  const { data: dynamicProductsData } = useQuery({
    queryKey: ["storefront-products-home"],
    queryFn: () => fetchStorefrontProducts(undefined, undefined, undefined, 1, 50),
    staleTime: 60000,
  });

  const { data: dynamicCategoriesData } = useQuery({
    queryKey: ["storefront-categories-home"],
    queryFn: () => fetchStorefrontCategories(),
    staleTime: 60000,
  });

  // Use live products from backend; only use fallback if no products exist yet
  const liveItems: OrganicProduct[] = (dynamicProductsData?.items || []).map((p, i) => mapStorefrontToOrganic(p, i));
  const combinedProducts: OrganicProduct[] = liveItems.length > 0 ? liveItems : fallbackProducts;

  // Render categories derived directly from active tenant's categories / products
  const categoriesList = React.useMemo(() => {
    if (dynamicCategoriesData && dynamicCategoriesData.length > 0) {
      return dynamicCategoriesData.map((c, i) => ({
        id: c.id,
        name: c.name,
        slug: c.name.toLowerCase().replace(/\s+/g, "-"),
        image: c.image_url || fallbackCategories[i % fallbackCategories.length]?.image || "/organic/images/category-thumb-1.jpg",
        itemCount: c.item_count || combinedProducts.filter(p => p.category?.toLowerCase() === c.name.toLowerCase()).length || 1,
      }));
    }
    if (liveItems.length > 0) {
      const distinctCats = Array.from(new Set(liveItems.map(p => p.category || p.brand).filter(Boolean)));
      return distinctCats.map((cat, i) => ({
        id: `cat-${i}`,
        name: String(cat),
        slug: String(cat).toLowerCase().replace(/\s+/g, "-"),
        image: fallbackCategories[i % fallbackCategories.length]?.image || "/organic/images/category-thumb-1.jpg",
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

  const handleMemberSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail || !memberEmail.includes("@")) {
      return toast.error("Please enter a valid email to claim your 25% discount.");
    }
    toast.success("Welcome! Coupon code ORGANIC25 has been applied to your account.");
    navigate({ to: "/store/shop" });
  };

  return (
    <div className="w-full bg-white font-organic-body pb-12">
      {/* ── 1. Hero Section ── */}
      <section className="bg-[#FAF8EF] border-b border-gray-100 py-12 md:py-16 overflow-hidden relative">
        {/* Decorative background gradients */}
        <div className="absolute -right-20 -top-20 size-96 rounded-full bg-[#6BB252]/10 blur-3xl pointer-events-none" />
        <div className="absolute left-10 -bottom-10 size-72 rounded-full bg-[#F95F09]/5 blur-2xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-gray-200/80 shadow-2xs">
                <span className="size-2 rounded-full bg-[#6BB252] animate-pulse" />
                <span className="text-xs font-bold text-[#6BB252] uppercase tracking-wider">
                  100% Organic Certified Harvest
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-[1.1] font-organic-heading">
                Organic Foods at <br className="hidden sm:inline" />
                <span className="text-[#6BB252] underline decoration-[#6BB252]/30 underline-offset-8">
                  your Doorsteps
                </span>
              </h1>

              <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Hand-picked farm fresh fruits, crisp seasonal vegetables, stoneground bakery treats,
                and wholesome dairy directly from local growers to your dining table.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Link
                  to="/store/shop"
                  className="bg-[#6BB252] hover:bg-[#5ba342] text-white font-bold text-sm px-8 py-3.5 rounded-full transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  Start Shopping <ArrowRight className="size-4" />
                </Link>

                <Link
                  to="/store/register"
                  className="bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-800 font-bold text-sm px-8 py-3.5 rounded-full transition-all"
                >
                  Join Now
                </Link>
              </div>

              {/* Stat Counters */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200/60 max-w-md mx-auto lg:mx-0">
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-gray-900">14k+</div>
                  <div className="text-xs text-gray-500 font-medium">Product Varieties</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-gray-900">50k+</div>
                  <div className="text-xs text-gray-500 font-medium">Happy Customers</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-gray-900">10+</div>
                  <div className="text-xs text-gray-500 font-medium">Store Locations</div>
                </div>
              </div>
            </div>

            {/* Right Hero Image Collage */}
            <div className="lg:col-span-5 flex justify-center relative">
              <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-white/70 border border-gray-200/60 p-6 flex items-center justify-center shadow-xl">
                <img
                  src="/organic/images/category-thumb-1.jpg"
                  alt="Fresh Organic Produce"
                  className="w-full h-full object-cover rounded-2xl"
                />

                {/* Floating promo badge */}
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs border border-gray-100 rounded-2xl p-3 shadow-lg flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[#F95F09]/15 text-[#F95F09] flex items-center justify-center font-black text-base">
                    %
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-gray-900">Flat 25% Off</span>
                    <span className="block text-[10px] text-gray-500">First order voucher</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Bottom Feature Pills */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 pt-8 border-t border-gray-200/60">
            <div className="bg-white/80 backdrop-blur-xs border border-gray-100 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="size-11 rounded-xl bg-[#6BB252]/15 text-[#6BB252] flex items-center justify-center shrink-0">
                <Award className="size-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider">Fresh from farm</h4>
                <p className="text-xs text-gray-500">Harvested daily and delivered within 24 hours.</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xs border border-gray-100 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="size-11 rounded-xl bg-[#6BB252]/15 text-[#6BB252] flex items-center justify-center shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider">100% Organic</h4>
                <p className="text-xs text-gray-500">Certified pesticide-free and non-GMO guaranteed.</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xs border border-gray-100 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
              <div className="size-11 rounded-xl bg-[#6BB252]/15 text-[#6BB252] flex items-center justify-center shrink-0">
                <Truck className="size-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider">Free delivery</h4>
                <p className="text-xs text-gray-500">Complimentary temperature-controlled shipping on $50+.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Category Carousel Section ── */}
      {categoriesList.length > 0 && (
        <section className="py-12 border-b border-gray-100">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900 font-organic-heading">Categories</h2>
                <p className="text-xs text-gray-500 mt-0.5">Explore our wide selection of products</p>
              </div>
              <Link
                to="/store/shop"
                className="text-xs font-bold text-[#6BB252] hover:text-[#5ba342] flex items-center gap-1 group"
              >
                View All <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {categoriesList.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => navigate({ to: "/store/shop", search: { category: cat.name } })}
                  className="group flex flex-col items-center text-center p-3 rounded-2xl bg-white border border-gray-100 hover:border-[#6BB252]/40 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="size-16 sm:size-20 rounded-full overflow-hidden bg-[#FAF8EF] mb-3 border border-gray-100 group-hover:scale-105 transition-transform duration-300">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <h3 className="font-bold text-xs text-gray-800 group-hover:text-[#6BB252] transition-colors line-clamp-1">
                    {cat.name}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-medium">{cat.itemCount} items</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Best Selling Products Section with Category Tabs ── */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-black text-gray-900 font-organic-heading">
                Best selling products
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Top-rated pantry and fresh essentials this week</p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
              {dynamicCategoryTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveCategoryTab(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    activeCategoryTab === tab
                      ? "bg-[#6BB252] text-white shadow-xs"
                      : "text-gray-600 hover:text-black hover:bg-gray-100"
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
              <OrganicProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Promo Banners Grid (3 Big Promo Tiles) ── */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Banner 1 */}
            <div
              onClick={() => navigate({ to: "/store/shop", search: { filter: "sale" } })}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF9EB] to-[#FCEFDA] p-8 border border-amber-100/80 shadow-sm cursor-pointer hover:shadow-md transition-all"
            >
              <div className="relative z-10 space-y-3 max-w-[65%]">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F95F09] text-white uppercase tracking-wider">
                  Weekly Deal
                </span>
                <h3 className="text-2xl font-black text-gray-900 font-organic-heading leading-tight">
                  Items on SALE
                </h3>
                <p className="text-xs text-gray-600 font-semibold">Discounts up to 30%</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6BB252] group-hover:translate-x-1 transition-transform">
                  Shop Now <ArrowRight className="size-3.5" />
                </span>
              </div>
              <img
                src="/organic/images/product-thumb-4.png"
                alt="Items on sale"
                className="absolute -right-4 -bottom-4 w-40 h-40 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-md"
              />
            </div>

            {/* Banner 2 */}
            <div
              onClick={() => navigate({ to: "/store/shop", search: { filter: "combo" } })}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#F0F7ED] to-[#E3EFE0] p-8 border border-emerald-100/80 shadow-sm cursor-pointer hover:shadow-md transition-all"
            >
              <div className="relative z-10 space-y-3 max-w-[65%]">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6BB252] text-white uppercase tracking-wider">
                  Bundle & Save
                </span>
                <h3 className="text-2xl font-black text-gray-900 font-organic-heading leading-tight">
                  Combo offers
                </h3>
                <p className="text-xs text-gray-600 font-semibold">Discounts up to 50%</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6BB252] group-hover:translate-x-1 transition-transform">
                  Shop Now <ArrowRight className="size-3.5" />
                </span>
              </div>
              <img
                src="/organic/images/product-thumb-8.png"
                alt="Combo offers"
                className="absolute -right-4 -bottom-4 w-40 h-40 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-md"
              />
            </div>

            {/* Banner 3 */}
            <div
              onClick={() => navigate({ to: "/store/shop", search: { filter: "coupons" } })}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF5F0] to-[#FFE7DA] p-8 border border-orange-100/80 shadow-sm cursor-pointer hover:shadow-md transition-all"
            >
              <div className="relative z-10 space-y-3 max-w-[65%]">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#222222] text-white uppercase tracking-wider">
                  Vouchers
                </span>
                <h3 className="text-2xl font-black text-gray-900 font-organic-heading leading-tight">
                  Discount Coupons
                </h3>
                <p className="text-xs text-gray-600 font-semibold">Discounts up to 40%</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6BB252] group-hover:translate-x-1 transition-transform">
                  Shop Now <ArrowRight className="size-3.5" />
                </span>
              </div>
              <img
                src="/organic/images/product-thumb-11.png"
                alt="Discount coupons"
                className="absolute -right-4 -bottom-4 w-40 h-40 object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Featured Products Section ── */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-gray-900 font-organic-heading">
                Featured Products
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Directly sourced from regional family farms</p>
            </div>
            <Link
              to="/store/shop"
              className="text-xs font-bold text-[#6BB252] hover:text-[#5ba342] flex items-center gap-1 group"
            >
              View All <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {combinedProducts.filter((p: OrganicProduct) => p.featured || p.id).slice(0, 4).map((product: OrganicProduct) => (
              <OrganicProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. 25% Discount Signup Banner ── */}
      <section className="py-10">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#6BB252] to-[#5ba342] text-white p-8 md:p-14 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Background decoration */}
            <div className="absolute right-0 top-0 size-96 rounded-full bg-white/10 blur-2xl pointer-events-none" />

            <div className="relative z-10 max-w-xl space-y-2 text-center md:text-left">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-white/20 uppercase tracking-widest text-white">
                Member Privilege
              </span>
              <h2 className="text-3xl sm:text-4xl font-black font-organic-heading">
                Get 25% Discount on your first purchase
              </h2>
              <p className="text-xs sm:text-sm text-white/90">
                Just Sign Up & Register now to receive exclusive organic discounts and priority delivery slots.
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
                className="bg-[#222222] hover:bg-black text-white font-bold text-xs px-7 py-3.5 rounded-full transition-colors shrink-0 shadow-md cursor-pointer"
              >
                Register
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── 7. Most Popular Products Section ── */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-gray-900 font-organic-heading">
                Most popular products
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Top customer picks with 5-star verified reviews</p>
            </div>
            <Link
              to="/store/shop"
              className="text-xs font-bold text-[#6BB252] hover:text-[#5ba342] flex items-center gap-1 group"
            >
              View All <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {combinedProducts.filter((p: OrganicProduct) => p.popular || p.id).slice(0, 8).map((product: OrganicProduct) => (
              <OrganicProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. Latest Blog Section ── */}
      <section className="py-12 bg-[#FAF8EF]/50 border-t border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-gray-900 font-organic-heading">Latest Blog</h2>
              <p className="text-xs text-gray-500 mt-0.5">Health insights, recipes, and organic living guides</p>
            </div>
            <Link
              to="/store/blog"
              className="text-xs font-bold text-[#6BB252] hover:text-[#5ba342] flex items-center gap-1 group"
            >
              View All <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {organicBlogPosts.map((post) => (
              <article
                key={post.id}
                onClick={() => navigate({ to: `/store/blog/${post.id}` })}
                className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all cursor-pointer flex flex-col"
              >
                <div className="aspect-[16/10] overflow-hidden bg-gray-100 relative">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                    {post.date}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#6BB252] uppercase tracking-wider">
                      {post.category}
                    </span>
                    <h3 className="font-bold text-base text-gray-900 group-hover:text-[#6BB252] transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-gray-100 text-xs font-bold text-gray-700 group-hover:text-[#6BB252]">
                    <span>Read Article</span>
                    <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. Mobile App Download Banner ── */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-[#FAF8EF] border border-gray-200/80 p-8 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-xl text-center lg:text-left">
              <span className="text-xs font-extrabold text-[#6BB252] uppercase tracking-widest">
                Mobile Convenience
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 font-organic-heading leading-tight">
                Online Orders made easy, fast and reliable
              </h2>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                Download the LazyMonkey mobile app on iOS and Android to reorder groceries in 1 tap, track live
                driver deliveries, and unlock special member flash promotions.
              </p>

              {/* App store buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Opening App Store download link...");
                  }}
                  className="hover:opacity-85 transition-opacity"
                >
                  <img
                    src="/organic/images/img-app-store.png"
                    alt="Download on App Store"
                    className="h-10 w-auto"
                  />
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Opening Google Play download link...");
                  }}
                  className="hover:opacity-85 transition-opacity"
                >
                  <img
                    src="/organic/images/img-google-play.png"
                    alt="Get it on Google Play"
                    className="h-10 w-auto"
                  />
                </a>
              </div>
            </div>

            {/* App Mockup graphic */}
            <div className="relative max-w-xs lg:max-w-sm flex justify-center">
              <img
                src="/organic/images/banner-onlineapp.png"
                alt="Mobile App"
                className="w-full h-auto object-contain drop-shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
