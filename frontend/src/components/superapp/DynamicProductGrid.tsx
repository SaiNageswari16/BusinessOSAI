import { Star, Plus, Eye, Heart, ShoppingCart } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Product {
  id: string | number;
  name: string;
  selling_price: number;
  image_url?: string;
  category_name?: string;
  rating?: number;
  brand?: string;
}

interface DynamicProductGridProps {
  products: Product[];
  activeCategory: string;
}

export function DynamicProductGrid({ products, activeCategory }: DynamicProductGridProps) {
  
  // Choose render style based on category
  const renderCard = (product: Product) => {
    switch(activeCategory) {
      case "Grocery":
      case "Pharmacy":
        return <GroceryCard key={product.id} product={product} />;
      case "Fashion":
      case "Jewellery":
        return <FashionCard key={product.id} product={product} />;
      case "Electronics":
        return <TechCard key={product.id} product={product} />;
      default:
        return <DefaultCard key={product.id} product={product} />;
    }
  };

  return (
    <section className="py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl md:text-2xl font-black text-[#1A1A1A]">
          Recommended <span className="text-blue-600">{activeCategory}</span>
        </h2>
        <Link to="/store/shop" className="text-gray-500 hover:text-blue-600 font-bold text-sm transition-colors">See All</Link>
      </div>
      
      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          No products found for {activeCategory}.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.slice(0, 10).map(renderCard)}
        </div>
      )}
    </section>
  );
}

// ----------------- Card Variants ----------------- //

function GroceryCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-100 hover:border-green-500 hover:shadow-lg transition-all group flex flex-col h-full cursor-pointer relative overflow-hidden">
      <div className="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden p-4 relative">
        <img src={product.image_url || "https://placehold.co/200x200?text=Grocery"} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
      </div>
      <div className="flex-1 flex flex-col">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{product.brand || 'Fresh'}</span>
        <h3 className="font-semibold text-sm text-[#1A1A1A] line-clamp-2 mb-2 flex-1">{product.name}</h3>
        <div className="flex items-center justify-between mt-auto">
          <span className="font-black text-lg">Rs {Number(product.selling_price).toFixed(2)}</span>
          <button className="bg-green-100 text-green-700 hover:bg-green-600 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FashionCard({ product }: { product: Product }) {
  return (
    <div className="bg-white group cursor-pointer h-full flex flex-col relative">
      <div className="aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden relative mb-3">
        <img src={product.image_url || "https://placehold.co/300x400?text=Fashion"} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        
        {/* Hover Actions */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent translate-y-full group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex justify-center gap-2">
          <button className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors">
            <Heart className="w-5 h-5" />
          </button>
          <button className="bg-black text-white px-4 h-10 rounded-full flex items-center justify-center font-bold text-sm hover:bg-white hover:text-black transition-colors flex-1">
            Add to Bag
          </button>
        </div>
      </div>
      <div className="text-center px-2">
        <h3 className="font-bold text-[#1A1A1A] text-sm line-clamp-1 group-hover:text-pink-600 transition-colors">{product.name}</h3>
        <span className="text-gray-500 text-sm mt-1 block">Rs {Number(product.selling_price).toFixed(2)}</span>
      </div>
    </div>
  );
}

function TechCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col h-full cursor-pointer relative">
      <div className="flex justify-between items-start mb-2">
        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">Tech</span>
        <div className="flex items-center text-xs font-bold text-gray-500">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 mr-1" />
          {product.rating || "4.8"}
        </div>
      </div>
      <div className="aspect-video bg-white mb-4 flex items-center justify-center">
        <img src={product.image_url || "https://placehold.co/300x200?text=Tech"} alt={product.name} className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform" />
      </div>
      <h3 className="font-bold text-[#1A1A1A] line-clamp-2 mb-4 flex-1 text-sm">{product.name}</h3>
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="font-black text-xl tracking-tight">Rs {Number(product.selling_price).toFixed(2)}</span>
        <button className="text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white p-2 rounded-xl transition-colors">
          <ShoppingCart className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function DefaultCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-100 hover:shadow-lg transition-all group h-full flex flex-col">
      <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-gray-50">
        <img src={product.image_url || "https://placehold.co/200x200"} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
      </div>
      <h3 className="font-semibold text-sm text-[#1A1A1A] line-clamp-2 mb-2 flex-1">{product.name}</h3>
      <div className="flex items-center justify-between mt-auto">
        <span className="font-black text-lg">Rs {Number(product.selling_price).toFixed(2)}</span>
        <button className="bg-gray-100 hover:bg-black hover:text-white text-black w-8 h-8 rounded-full flex items-center justify-center transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
