import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Star, Heart, ShoppingCart, Check, Plus, Minus, Home,
  ShieldCheck, Truck, RefreshCcw, ArrowRight, Award, Share2, Store, Package
} from "lucide-react";
import {
  organicProducts as fallbackProducts,
  OrganicProduct
} from "@/data/mockOrganicData";
import { OrganicProductCard } from "@/components/storefront/organic/OrganicProductCard";
import { fetchStorefrontProductById, fetchStorefrontProducts, mapStorefrontToOrganic } from "@/lib/storefront-api";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/product/$id")({
  component: SingleProductPage,
});

function SingleProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { addToCart, wishlistItems, toggleWishlist } = useStoreCart();

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"desc" | "nutrition" | "shipping" | "reviews">("desc");
  const [isAdded, setIsAdded] = useState(false);

  // Fetch product from backend
  const { data: apiProduct, isLoading } = useQuery({
    queryKey: ["storefront-single-product", id],
    queryFn: () => fetchStorefrontProductById(id),
    retry: 1,
  });

  // Fetch related products
  const { data: relatedApiProducts } = useQuery({
    queryKey: ["storefront-related-products"],
    queryFn: () => fetchStorefrontProducts(undefined, undefined, undefined, 1, 8),
    staleTime: 60000,
  });

  // Find product by id from API or fallback to mock
  const product: OrganicProduct = useMemo(() => {
    if (apiProduct) {
      return mapStorefrontToOrganic(apiProduct);
    }
    return fallbackProducts.find((p) => p.id === id) || fallbackProducts[0];
  }, [apiProduct, id]);

  const isFavorited = wishlistItems.some((item) => item.id === product.id);

  const relatedProducts: OrganicProduct[] = useMemo(() => {
    if (relatedApiProducts?.items && relatedApiProducts.items.length > 0) {
      return relatedApiProducts.items
        .filter((p) => String(p.id) !== product.id)
        .slice(0, 4)
        .map((p, i) => mapStorefrontToOrganic(p, i));
    }
    return fallbackProducts
      .filter((p) => p.id !== product.id)
      .slice(0, 4);
  }, [relatedApiProducts, product.id]);

  const handleAddToCart = () => {
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        mrp: product.originalPrice,
        image_url: product.image,
        category_name: product.category,
      },
      quantity
    );
    setIsAdded(true);
    toast.success(`Added ${quantity}x "${product.name}" to cart!`);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        mrp: product.originalPrice,
        image_url: product.image,
        category_name: product.category,
      },
      quantity
    );
    navigate({ to: "/store/checkout" });
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* ── Breadcrumb ── */}
      <div className="bg-[#FAF8EF] py-6 mb-8 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <Link to="/store/shop" className="hover:text-[#6BB252] transition-colors">
              Shop
            </Link>
            <span>/</span>
            <span className="text-gray-400">{product.category}</span>
            <span>/</span>
            <span className="text-[#6BB252] font-bold truncate max-w-xs">{product.name}</span>
          </div>
        </div>
      </div>

      {/* ── Main Product Display ── */}
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Product Media Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square rounded-3xl bg-[#FAF8EF] border border-gray-100 p-8 flex items-center justify-center overflow-hidden group">
              {product.discountBadge && (
                <span className="absolute top-5 left-5 bg-[#F95F09] text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                  {product.discountBadge}
                </span>
              )}
              <img
                src={product.image}
                alt={product.name}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 drop-shadow-md"
              />
            </div>

            {/* Thumbnail selector row */}
            <div className="grid grid-cols-4 gap-3">
              {[product.image, product.image, product.image, product.image].map((img, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-[#FAF8EF] border border-gray-200/80 p-2 flex items-center justify-center cursor-pointer hover:border-[#6BB252]"
                >
                  <img src={img} alt="Thumbnail" className="max-h-full max-w-full object-contain" />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Product Details & Purchase Form */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#6BB252] bg-[#f0f7ed] px-2.5 py-0.5 rounded-md">
                  {product.category}
                </span>
                {product.brand && (
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                    Brand: {product.brand}
                  </span>
                )}
                {product.sku && (
                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md">
                    SKU: {product.sku}
                  </span>
                )}
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="size-3" /> In Stock & Fresh
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 font-organic-heading leading-tight">
                {product.name}
              </h1>

              {/* Review Stars & Seller badge */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-4",
                          i < Math.floor(product.rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-200 fill-gray-200"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-gray-700">{product.rating}</span>
                  <span className="text-xs text-gray-400">({product.reviewsCount} verified reviews)</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-[#FAF8EF] px-3 py-1 rounded-full border border-gray-200/80">
                  <Store className="size-3.5 text-[#6BB252]" />
                  <span className="text-gray-500">Sold by:</span>
                  <span className="font-bold text-gray-900">{product.sellerName || "Verified Store"}</span>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="p-4 rounded-2xl bg-[#FAF8EF] border border-gray-200/60 flex items-baseline gap-3">
              <span className="text-3xl font-black text-gray-900">
                {currency.symbol}{product.price.toFixed(2)}
              </span>
              {product.originalPrice > product.price && (
                <del className="text-base text-gray-400 font-normal">
                  {currency.symbol}{product.originalPrice.toFixed(2)}
                </del>
              )}
              <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                Unit: {product.unit}
              </span>
            </div>

            {/* Product short description */}
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {product.description}
            </p>

            {/* Quantity Stepper & Buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                {/* Stepper */}
                <div className="flex items-center border border-gray-300 rounded-xl bg-gray-50/80 p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="size-9 flex items-center justify-center text-gray-600 hover:text-black hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-gray-900 select-none">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="size-9 flex items-center justify-center text-gray-600 hover:text-black hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>

                {/* Add to Cart */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={cn(
                    "flex-1 min-w-[160px] py-3 px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md",
                    isAdded
                      ? "bg-emerald-600 text-white"
                      : "bg-[#6BB252] hover:bg-[#5ba342] text-white hover:shadow-lg"
                  )}
                >
                  {isAdded ? (
                    <>
                      <Check className="size-4" /> Added to Basket
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="size-4" /> Add to Cart
                    </>
                  )}
                </button>

                {/* Wishlist toggle button */}
                <button
                  type="button"
                  onClick={() => toggleWishlist({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    mrp: product.originalPrice,
                    image_url: product.image,
                  })}
                  className={cn(
                    "size-12 rounded-xl border flex items-center justify-center transition-all cursor-pointer",
                    isFavorited
                      ? "bg-red-50 text-red-500 border-red-200"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-red-500"
                  )}
                  title="Add to Wishlist"
                >
                  <Heart className={cn("size-5", isFavorited && "fill-red-500")} />
                </button>
              </div>

              {/* Buy Now Button */}
              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full py-3 px-6 bg-[#222222] hover:bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                Instant Buy Now <ArrowRight className="size-4" />
              </button>
            </div>

            {/* Guarantee Pills */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100 text-center">
              <div className="p-2.5 rounded-xl bg-[#FAF8EF] border border-gray-100">
                <Truck className="size-4 text-[#6BB252] mx-auto mb-1" />
                <span className="block text-[10px] font-bold text-gray-800">Free Shipping</span>
                <span className="block text-[9px] text-gray-400">On orders $50+</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF8EF] border border-gray-100">
                <ShieldCheck className="size-4 text-[#6BB252] mx-auto mb-1" />
                <span className="block text-[10px] font-bold text-gray-800">100% Organic</span>
                <span className="block text-[9px] text-gray-400">Pesticide free</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FAF8EF] border border-gray-100">
                <RefreshCcw className="size-4 text-[#6BB252] mx-auto mb-1" />
                <span className="block text-[10px] font-bold text-gray-800">Fresh Guarantee</span>
                <span className="block text-[9px] text-gray-400">Easy replacement</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Product Information Tabs ── */}
        <div className="mt-16 border-t border-gray-100 pt-10">
          <div className="flex border-b border-gray-200 gap-6">
            {[
              { id: "desc", label: "Description" },
              { id: "nutrition", label: "Nutritional Information" },
              { id: "shipping", label: "Shipping & Delivery" },
              { id: "reviews", label: `Reviews (${product.reviewsCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "pb-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer border-b-2 -mb-[2px]",
                  activeTab === tab.id
                    ? "border-[#6BB252] text-[#6BB252]"
                    : "border-transparent text-gray-500 hover:text-black"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="py-6 text-xs sm:text-sm text-gray-600 leading-relaxed max-w-3xl">
            {activeTab === "desc" && (
              <div className="space-y-3">
                <p>{product.description}</p>
                <p>
                  Sourced sustainably from regional organic farms, guaranteeing that no chemical pesticides,
                  herbicides, or synthetic additives were utilized throughout the cultivation cycle.
                </p>
              </div>
            )}

            {activeTab === "nutrition" && (
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900">Per 100g Serving:</h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600">
                  <li>Calories: 140 kcal</li>
                  <li>Dietary Fiber: 4.5g</li>
                  <li>Total Protein: 6.2g</li>
                  <li>Total Carbohydrates: 22.0g (zero refined sugars)</li>
                  <li>Sodium: 15mg</li>
                </ul>
              </div>
            )}

            {activeTab === "shipping" && (
              <div className="space-y-2">
                <p>Orders placed before 2:00 PM are delivered same-day in insulated temperature-controlled cold boxes.</p>
                <p>Doorstep delivery is 100% free on grocery orders over $50.</p>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#FAF8EF] border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-gray-900">Sarah Jenkins</span>
                    <span className="text-[10px] text-gray-400">Verified Buyer • 2 days ago</span>
                  </div>
                  <div className="flex text-amber-400 mb-1.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="size-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">
                    Exceptionally fresh and arrived chilled at my doorstep in under 2 hours! Highly recommended.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Related Products Carousel ── */}
        <div className="mt-16 border-t border-gray-100 pt-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-gray-900 font-organic-heading">
                Related Organic Products
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Customers who viewed this item also loved</p>
            </div>
            <Link
              to="/store/shop"
              className="text-xs font-bold text-[#6BB252] hover:text-[#5ba342] flex items-center gap-1"
            >
              View All <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <OrganicProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
