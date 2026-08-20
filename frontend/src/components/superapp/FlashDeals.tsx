import { Clock, Zap } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontFlashDeals } from "@/lib/storefront-api";
import { useCurrency } from "@/hooks/use-currency";

export function FlashDeals() {
    const { currency, formatCurrency } = useCurrency();
  const [timeLeft, setTimeLeft] = useState({ h: 2, m: 45, s: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { h, m, s } = prev;
        if (s > 0) s--;
        else {
          s = 59;
          if (m > 0) m--;
          else {
            m = 59;
            if (h > 0) h--;
          }
        }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navigate = useNavigate();
  const { data: dealsData } = useQuery({
    queryKey: ['storefrontFlashDeals'],
    queryFn: () => fetchStorefrontFlashDeals(4),
    staleTime: 60_000,
  });

  const allProducts = dealsData ?? [];
  // Products are already filtered and ordered by backend
  const deals = allProducts.map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.selling_price,
    oldPrice: p.mrp,
    discount: Math.round(((p.mrp - p.selling_price) / p.mrp) * 100),
    img: p.image_url || "https://placehold.co/300x300?text=Product"
  }));

  if (deals.length === 0) {
    return null; // Hide flash deals if no discounted products exist
  }

  return (
    <section className="py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl md:text-2xl font-black text-[#1A1A1A] flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" /> Flash Deals
          </h2>
          <div className="hidden sm:flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm font-bold">
            <Clock className="w-4 h-4" />
            <span>{String(timeLeft.h).padStart(2, '0')}:{String(timeLeft.m).padStart(2, '0')}:{String(timeLeft.s).padStart(2, '0')}</span>
          </div>
        </div>
        <Link to="/store/shop" className="text-blue-600 font-bold text-sm hover:underline">View All</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {deals.map((deal: any) => (
          <div key={deal.id} onClick={() => navigate({ to: '/store/product/$id', params: { id: deal.id } })} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-lg transition-all group cursor-pointer relative overflow-hidden">
            {/* Discount Badge */}
            <div className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-black px-2 py-1 rounded-lg">
              -{deal.discount}%
            </div>
            
            <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-gray-50 relative flex items-center justify-center">
              <img src={deal.img} alt={deal.name} className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-bold text-[#1A1A1A] line-clamp-1 group-hover:text-blue-600 transition-colors text-sm">{deal.name}</h3>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-[#1A1A1A]">Rs {Number(deal.price).toFixed(2)}</span>
                <span className="text-xs text-gray-400 line-through">Rs {Number(deal.oldPrice).toFixed(2)}</span>
              </div>
            </div>

            {/* Hover Add Button */}
            <div className="absolute bottom-3 right-3 translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <button className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md" onClick={(e) => { e.stopPropagation(); /* Add to cart logic here */ }}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
