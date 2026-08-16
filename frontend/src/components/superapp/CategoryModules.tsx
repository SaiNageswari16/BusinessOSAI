import { 
  ShoppingBag, 
  Shirt, 
  Gem, 
  Smartphone, 
  Sofa, 
  Pill, 
  UtensilsCrossed, 
  Pizza, 
  Hotel, 
  Plane, 
  Film, 
  Ticket, 
  Wrench, 
  Store, 
  Download, 
  Crown, 
  Gift 
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

interface CategoryModulesProps {
  onSelectCategory: (category: string) => void;
  activeCategory: string;
}

export function CategoryModules({ onSelectCategory, activeCategory }: CategoryModulesProps) {
    const { currency, formatCurrency } = useCurrency();
  const modules = [
    { id: "Grocery", icon: ShoppingBag, color: "bg-green-100 text-green-600" },
    { id: "Fashion", icon: Shirt, color: "bg-pink-100 text-pink-600" },
    { id: "Jewellery", icon: Gem, color: "bg-yellow-100 text-yellow-600" },
    { id: "Electronics", icon: Smartphone, color: "bg-blue-100 text-blue-600" },
    { id: "Furniture", icon: Sofa, color: "bg-orange-100 text-orange-600" },
    { id: "Pharmacy", icon: Pill, color: "bg-teal-100 text-teal-600" },
    { id: "Dine-Out", icon: UtensilsCrossed, color: "bg-red-100 text-red-600" },
    { id: "Delivery", icon: Pizza, color: "bg-amber-100 text-amber-600" },
    { id: "Hotels", icon: Hotel, color: "bg-indigo-100 text-indigo-600" },
    { id: "Travel", icon: Plane, color: "bg-cyan-100 text-cyan-600" },
    { id: "OTT", icon: Film, color: "bg-purple-100 text-purple-600" },
    { id: "Events", icon: Ticket, color: "bg-rose-100 text-rose-600" },
    { id: "Services", icon: Wrench, color: "bg-slate-100 text-slate-600" },
    { id: "Marketplace", icon: Store, color: "bg-fuchsia-100 text-fuchsia-600" },
    { id: "Digital", icon: Download, color: "bg-lime-100 text-lime-600" },
    { id: "Memberships", icon: Crown, color: "bg-violet-100 text-violet-600" },
    { id: "Gift Cards", icon: Gift, color: "bg-emerald-100 text-emerald-600" },
  ];

  return (
    <section className="py-6">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-lg font-black text-[#1A1A1A] tracking-tight">Explore Services</h2>
      </div>
      
      {/* Horizontal Scrollable container */}
      <div className="flex overflow-x-auto pb-4 gap-4 hide-scrollbar snap-x">
        {modules.map((mod) => {
          const isActive = activeCategory === mod.id;
          const Icon = mod.icon;
          return (
            <div 
              key={mod.id} 
              onClick={() => onSelectCategory(mod.id)}
              className="flex flex-col items-center gap-2 cursor-pointer snap-start min-w-[72px] sm:min-w-[80px] group"
            >
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-lg scale-110' : mod.color + ' group-hover:scale-105 group-hover:shadow-md'}`}>
                <Icon className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <span className={`text-xs font-semibold text-center whitespace-nowrap transition-colors ${isActive ? 'text-blue-600' : 'text-gray-600 group-hover:text-[#1A1A1A]'}`}>
                {mod.id}
              </span>
            </div>
          );
        })}
      </div>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
