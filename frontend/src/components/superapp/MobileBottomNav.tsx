import { Home, Search, ShoppingBag, User, Heart } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useCurrency } from "@/hooks/use-currency";

export function MobileBottomNav() {
    const { currency, formatCurrency } = useCurrency();
  const location = useLocation();
  const { cartCount } = useStoreCart();

  const navItems = [
    { name: "Home", path: "/store", icon: Home },
    { name: "Search", path: "/store/search", icon: Search },
    { name: "Cart", path: "/store/cart", icon: ShoppingBag, badge: cartCount },
    { name: "Wishlist", path: "/store/wishlist", icon: Heart },
    { name: "Profile", path: "/store/account", icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 pb-safe z-50 shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === "/store" && location.pathname === "/store/");
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.name}
              to={item.path}
              className="relative flex flex-col items-center justify-center w-full h-full text-center group"
            >
              <div className={`transition-all duration-300 ${isActive ? 'text-purple-900 -translate-y-1' : 'text-gray-400 group-hover:text-gray-600'}`}>
                <Icon className={`w-6 h-6 ${isActive ? 'fill-purple-100' : ''}`} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 right-2 bg-red-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold mt-1 transition-colors ${isActive ? 'text-purple-900 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}>
                {item.name}
              </span>
              
              {/* Active Dot */}
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-purple-900 rounded-full"></div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
