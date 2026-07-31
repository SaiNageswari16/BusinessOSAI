import { Search, Heart, Bell, ShoppingBag, User, MapPin, Grid, Wallet, Sparkles, X, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStorefrontNotifications, markStorefrontNotificationsRead } from "@/lib/storefront-api";

export function SuperAppHeader() {
  const { cartCount } = useStoreCart();
  const wishlistCount = 0;
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  // Add scroll listener for sticky glassmorphism
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [showNotifications, setShowNotifications] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Notifications
  const { data: notifications = [] as any[] } = useQuery({
    queryKey: ['storefrontNotifications'],
    queryFn: fetchStorefrontNotifications,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: markStorefrontNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefrontNotifications'] });
    }
  });

  const handleSearch = (e: React.FormEvent, aiSearch = false) => {
    e.preventDefault();
    navigate({
      to: '/store/search',
      search: { q: searchQuery.trim() }
    });
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-white'}`}>
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        
        {/* Left: Logo & Location */}
        <div className="flex items-center gap-6">
          <Link to="/store" className="flex-shrink-0 flex items-center gap-2 group">
            <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-105">
              <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="w-full h-full object-contain" />
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xl font-black tracking-tight text-[#1A1A1A] leading-none">LazyMonkey<span className="text-amber-500">AI</span></span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Smart AI Store</span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-2 hover:bg-gray-100 p-2 rounded-xl cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Delivering to</span>
              <span className="text-xs font-bold text-[#1A1A1A]">Hyderabad, 500045</span>
            </div>
          </div>
        </div>

        {/* Center: AI Search */}
        <div className="flex-1 max-w-2xl mx-auto hidden md:block">
          <form onSubmit={(e) => handleSearch(e, false)} className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-purple-900 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Ask AI to find anything (e.g. 'Laptop under Rs 1000')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-purple-900/20 focus:border-purple-900 border border-transparent rounded-2xl py-3 pl-12 pr-24 text-sm outline-none transition-all duration-300 shadow-inner"
            />
            <button
              type="button"
              onClick={(e) => handleSearch(e, true)}
              className="absolute inset-y-1.5 right-2 bg-gradient-to-r from-purple-900 to-amber-500 text-white text-xs font-bold px-4 rounded-xl shadow-sm hover:shadow-md hover:scale-105 transition-all flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> AI Search
            </button>
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/store/wallet" search={{ action: undefined }} className="hidden sm:flex items-center gap-2 hover:bg-gray-100 p-2 rounded-xl cursor-pointer transition-colors border border-gray-200">
            <Wallet className="w-5 h-5 text-amber-500" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase">LazyMonkey Coins</span>
              <span className="text-xs font-bold text-[#1A1A1A]">2,450 🍌</span>
            </div>
          </Link>

          <Link to="/store/wishlist" className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center relative transition-colors text-gray-700">
            <Heart className="w-5 h-5" />
            {wishlistCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white">
                {wishlistCount}
              </span>
            )}
          </Link>

          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (unreadCount > 0 && !showNotifications) {
                  markReadMutation.mutate();
                }
              }}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center relative transition-colors text-gray-700"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">Notifications</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-6">No new notifications</div>
                  ) : (
                    notifications.map(notif => (
                      <Link 
                        key={notif.id} 
                        to={notif.action_url || "#"} 
                        onClick={() => setShowNotifications(false)}
                        className={`block p-3 rounded-xl hover:bg-gray-50 transition-colors mb-1 ${!notif.is_read ? 'bg-purple-50/30' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notif.is_read ? 'bg-gray-100' : 'bg-purple-100'}`}>
                            <Bell className={`w-4 h-4 ${notif.is_read ? 'text-gray-500' : 'text-purple-900'}`} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{notif.title}</h4>
                            <p className="text-xs text-gray-500 leading-snug">{notif.body}</p>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Link to="/store/cart" className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center relative transition-colors text-gray-700">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white">
                {cartCount}
              </span>
            )}
          </Link>

          <Link to="/store/account" className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-purple-900 transition-all text-gray-500">
            <User className="w-5 h-5" />
          </Link>
        </div>
      </div>
      
      {/* Mobile Search Bar (Only visible on small screens) */}
      <div className="md:hidden px-4 pb-3">
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search for anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none border border-transparent focus:bg-white focus:border-purple-900"
          />
        </form>
      </div>
    </header>
  );
}
