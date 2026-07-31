import { createFileRoute } from "@tanstack/react-router";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { mockVendors } from "@/data/mockMarketplaceData";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontProducts } from "@/lib/storefront-api";
import { Link } from "@tanstack/react-router";
import { Star, Truck, RefreshCw, Headset, Clock, ChevronRight, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

function StoreHome() {
  const [activeTab, setActiveTab] = useState("All");
  const [dealTime, setDealTime] = useState({ days: 12, hours: 15, mins: 45, secs: 30 });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefrontProducts'],
    queryFn: () => fetchStorefrontProducts(),
    staleTime: 60_000, // 1 min cache
  });
  const allProducts = data?.items ?? [];


  // Derive unique categories from actual product data
  const liveCategories = Array.from(new Set(allProducts.map(p => p.category_name).filter(Boolean))) as string[];
  const tabOptions = ["All", ...liveCategories];

  // Filter products by active tab for Trending Products
  const trendingProducts = activeTab === "All" 
    ? allProducts.slice(0, 8)
    : allProducts.filter(p => p.category_name === activeTab).slice(0, 8);
    
  // Our Products tabs
  const [ourProductsTab, setOurProductsTab] = useState("Special");
  
  // Simulated countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDealTime(prev => {
        let { days, hours, mins, secs } = prev;
        if (secs > 0) secs--;
        else {
          secs = 59;
          if (mins > 0) mins--;
          else {
            mins = 59;
            if (hours > 0) hours--;
            else {
              hours = 23;
              if (days > 0) days--;
            }
          }
        }
        return { days, hours, mins, secs };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const categories = [
    { name: "Electronics", img: "https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=200&h=200&fit=crop" },
    { name: "Fashion", img: "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=200&h=200&fit=crop" },
    { name: "Furniture", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=200&h=200&fit=crop" },
    { name: "Automotive", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=200&h=200&fit=crop" },
    { name: "Beauty", img: "https://images.unsplash.com/photo-1596462502278-27bf85033e5a?q=80&w=200&h=200&fit=crop" },
    { name: "Groceries", img: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&h=200&fit=crop" },
  ];

  return (
    <div className="w-full">
      {/* 1. Hero Banner Section */}
      <section className="relative w-full h-[500px] md:h-[600px] bg-[#F2F2F2] flex items-center mb-12">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1920&auto=format&fit=crop" 
            alt="Marketplace Hero" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10 flex justify-between items-center">
          <div className="max-w-xl text-white">
              <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium border border-white/20 backdrop-blur-md">
                Smart AI for Lazy Geniuses 🚀
              </span>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight">TOP RATED <br/> BRANDS</h1>
            <p className="text-lg mb-8 opacity-90">Discover the best electronics, fashion, and home goods all in one place.</p>
            <Link to="/store/shop" className="bg-purple-900 hover:bg-amber-600 text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-colors inline-block">
              Shop Now
            </Link>
          </div>
          {/* Mock Slider Controls */}
          <div className="hidden md:flex flex-col space-y-2">
            <div className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center cursor-pointer text-white backdrop-blur-sm transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </div>
            <div className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center cursor-pointer text-white backdrop-blur-sm transition-colors">
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 space-y-20">
        
        {/* 2. Promo Banners */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative h-[250px] rounded-lg overflow-hidden group cursor-pointer shadow-sm">
            <img src="https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=800&auto=format&fit=crop" alt="Promo 1" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
            <div className="absolute inset-0 p-8 flex flex-col justify-center">
              <span className="text-purple-900 font-bold mb-2 tracking-wide uppercase text-sm">Tech Sale</span>
              <h3 className="text-3xl font-black text-white mb-4 leading-tight">Latest<br/>Electronics</h3>
              <span className="text-white font-bold underline hover:text-purple-900 transition-colors text-sm tracking-wider">SHOP NOW</span>
            </div>
          </div>
          <div className="relative h-[250px] rounded-lg overflow-hidden group cursor-pointer shadow-sm">
            <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=800&auto=format&fit=crop" alt="Promo 2" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent"></div>
            <div className="absolute inset-0 p-8 flex flex-col justify-center text-right items-end">
              <span className="text-purple-900 font-bold mb-2 tracking-wide uppercase text-sm">New Arrivals</span>
              <h3 className="text-3xl font-black text-white mb-4 leading-tight">Summer<br/>Fashion</h3>
              <span className="text-white font-bold underline hover:text-purple-900 transition-colors text-sm tracking-wider">SHOP NOW</span>
            </div>
          </div>
        </section>

        {/* 3. Shop By Category (Circular) */}
        <section>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-wide">Top Categories</h2>
            <div className="flex space-x-2">
              <button className="w-8 h-8 rounded-full border border-[#E5E4E2] flex items-center justify-center hover:bg-purple-900 hover:text-white hover:border-purple-900 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button className="w-8 h-8 rounded-full border border-[#E5E4E2] flex items-center justify-center hover:bg-purple-900 hover:text-white hover:border-purple-900 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {categories.map((cat, idx) => (
              <div key={idx} className="flex flex-col items-center group cursor-pointer">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-md mb-4 group-hover:border-purple-900 transition-colors">
                  <img src={cat.img} alt={cat.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                </div>
                <h4 className="font-bold text-[#1A1A1A] group-hover:text-purple-900 transition-colors">{cat.name}</h4>
                <p className="text-xs text-gray-500">{Math.floor(Math.random() * 50 + 10)} items</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Trending Products */}
        <section className="text-center">
          <h2 className="text-3xl font-black text-[#1A1A1A] mb-2 uppercase tracking-wide">Trending Products</h2>
          <div className="w-16 h-1 bg-purple-900 mx-auto mb-8"></div>
          
          {/* Filter tabs -- derived from real category names */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {tabOptions.map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-bold uppercase tracking-wider pb-2 border-b-2 transition-colors ${activeTab === tab ? 'text-purple-900 border-purple-900' : 'text-gray-500 border-transparent hover:text-[#1A1A1A]'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-purple-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-16 text-red-500">Could not load products. Please check your backend connection.</div>
          ) : (
            <ProductGrid products={trendingProducts} />
          )}
        </section>

        {/* 5. Deal of the Day Banner */}
        <section className="relative w-full h-[350px] rounded-xl overflow-hidden flex items-center">
          <img src="https://images.unsplash.com/photo-1550009158-9effb64fda70?q=80&w=1920&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover" alt="Deal Background" />
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="bg-gradient-to-r from-purple-900 via-[#361471] to-amber-600 py-12 md:py-20 relative overflow-hidden">
            <h4 className="text-purple-900 font-bold uppercase tracking-widest mb-2">Special Offer</h4>
            <h2 className="text-4xl md:text-5xl font-black mb-6">Deal of the Day</h2>
            <p className="mb-8 opacity-90 max-w-md">Get up to 50% off on selected electronics and gadgets. Limited time offer!</p>
            
            {/* Timer */}
            <div className="flex space-x-4 mb-8">
              {[
                { label: 'DAYS', val: dealTime.days },
                { label: 'HOURS', val: dealTime.hours },
                { label: 'MINS', val: dealTime.mins },
                { label: 'SECS', val: dealTime.secs }
              ].map(t => (
                <div key={t.label} className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-lg flex flex-col items-center justify-center border border-white/30">
                  <span className="text-xl font-bold">{t.val.toString().padStart(2, '0')}</span>
                  <span className="text-[10px] uppercase">{t.label}</span>
                </div>
              ))}
            </div>
            
            <Link to="/store/shop" className="bg-purple-900 hover:bg-amber-600 text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider transition-colors inline-block">
              Shop Now
            </Link>
          </div>
        </section>

        {/* 6. Our Products Tabs */}
        <section>
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-[#E5E4E2] pb-2">
            <div>
              <h2 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-wide mb-1">Our Products</h2>
              <div className="w-16 h-1 bg-purple-900"></div>
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              {["Special", "New", "Bestseller"].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setOurProductsTab(tab)}
                  className={`font-bold uppercase text-sm tracking-wider transition-colors ${ourProductsTab === tab ? 'text-purple-900' : 'text-gray-500 hover:text-[#1A1A1A]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          {/* Randomize grid for effect based on tab */}
          <ProductGrid products={[...allProducts].sort(() => 0.5 - Math.random())} />
        </section>

        {/* 7. Testimonials & Blogs */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Testimonial slider (col-span-4) */}
          <div className="lg:col-span-4 bg-[#F2F2F2] rounded-xl p-8 border border-[#E5E4E2] flex flex-col items-center text-center">
            <h3 className="text-xl font-black text-[#1A1A1A] uppercase tracking-wide mb-6">Our Customers Say</h3>
            <img src="https://i.pravatar.cc/100?img=33" alt="Customer" className="w-20 h-20 rounded-full border-4 border-white shadow-sm mb-6" />
            <div className="flex text-[#FFA41C] mb-4">
              {'★★★★★'}
            </div>
            <p className="text-gray-600 italic mb-6">
              "Amazing platform! I found the best electronics here and the delivery was incredibly fast. Highly recommended to everyone looking for quality."
            </p>
            <h4 className="font-bold text-[#1A1A1A]">David Johnson</h4>
            <span className="text-sm text-gray-500">Tech Enthusiast</span>
            
            <div className="flex space-x-2 mt-8">
              <div className="w-3 h-3 rounded-full bg-purple-900"></div>
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
            </div>
          </div>

          {/* Recent News / Blog (col-span-8) */}
          <div className="lg:col-span-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#1A1A1A] uppercase tracking-wide">Recent News</h3>
              <Link to="/store" className="text-sm font-bold text-gray-500 hover:text-purple-900 uppercase">View All</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: "Top 10 Gadgets for 2026", img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=400&h=250&fit=crop", date: "Jul 22, 2026" },
                { title: "Summer Fashion Trends", img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=400&h=250&fit=crop", date: "Jul 15, 2026" }
              ].map((blog, idx) => (
                <div key={idx} className="group cursor-pointer border border-[#E5E4E2] rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow">
                  <div className="overflow-hidden h-48">
                    <img src={blog.img} alt={blog.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-6">
                    <div className="text-sm text-purple-900 font-bold mb-2">{blog.date}</div>
                    <h4 className="text-lg font-bold text-[#1A1A1A] group-hover:text-purple-900 transition-colors mb-3 line-clamp-1">{blog.title}</h4>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-4">Discover the latest trends and must-have items for this season. Read our comprehensive guide.</p>
                    <span className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider group-hover:text-purple-900 border-b-2 border-transparent group-hover:border-purple-900 transition-all">Read More</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Brand Logo Carousel */}
        <section className="border-t border-b border-[#E5E4E2] py-8">
           <div className="flex justify-between items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
             {mockVendors.slice(0,5).map(v => (
               <div key={v.id} className="text-2xl font-black text-gray-400 uppercase tracking-widest text-center cursor-pointer hover:text-purple-900">
                 {v.name.split(' ')[0]}
               </div>
             ))}
           </div>
        </section>
        
        {/* 9. Service Features Bar */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-6">
          <div className="flex items-center p-4 bg-white rounded-lg group">
            <div className="w-14 h-14 rounded-full border border-[#E5E4E2] flex items-center justify-center text-purple-900 group-hover:bg-purple-900 group-hover:text-white transition-colors mr-4 flex-shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-[#1A1A1A] uppercase text-sm mb-1">Free Delivery</h4>
              <p className="text-xs text-gray-500">For all orders over $120</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-white rounded-lg group">
            <div className="w-14 h-14 rounded-full border border-[#E5E4E2] flex items-center justify-center text-purple-900 group-hover:bg-purple-900 group-hover:text-white transition-colors mr-4 flex-shrink-0">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-[#1A1A1A] uppercase text-sm mb-1">30 Days Return</h4>
              <p className="text-xs text-gray-500">If goods have problems</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-white rounded-lg group">
            <div className="w-14 h-14 rounded-full border border-[#E5E4E2] flex items-center justify-center text-purple-900 group-hover:bg-purple-900 group-hover:text-white transition-colors mr-4 flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-[#1A1A1A] uppercase text-sm mb-1">Secure Payment</h4>
              <p className="text-xs text-gray-500">100% secure payment</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-white rounded-lg group">
            <div className="w-14 h-14 rounded-full border border-[#E5E4E2] flex items-center justify-center text-purple-900 group-hover:bg-purple-900 group-hover:text-white transition-colors mr-4 flex-shrink-0">
              <Headset className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-[#1A1A1A] uppercase text-sm mb-1">24/7 Support</h4>
              <p className="text-xs text-gray-500">Dedicated support</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
