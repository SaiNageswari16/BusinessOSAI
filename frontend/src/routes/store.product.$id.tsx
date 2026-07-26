import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProductGallery } from "../components/storefront/ProductGallery";
import { ProductInfo } from "../components/storefront/ProductInfo";
import { mockMarketplaceProducts } from "../data/mockMarketplaceData";
import { ArrowLeft, Home } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/store/product/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const product = mockMarketplaceProducts.find(p => p.id === id);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-wide">Product Not Found</h1>
        <p className="text-gray-500 mt-4 mb-8">We couldn't find the product you're looking for.</p>
        <Link to="/store" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded uppercase font-bold transition-colors">
          Return to Storefront
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Vegist Style Breadcrumb */}
      <div className="bg-[#F2F2F2] py-6 mb-8">
        <div className="container mx-auto px-4 text-sm text-gray-500 flex items-center justify-center space-x-2">
          <Link to="/store" className="hover:text-blue-600 flex items-center transition-colors font-medium">
            <Home className="h-4 w-4 mr-1" />
            Home
          </Link>
          <span className="text-gray-400">/</span>
          <span className="hover:text-blue-600 cursor-pointer font-medium">{product.category}</span>
          <span className="text-gray-400">/</span>
          <span className="text-[#1A1A1A] font-bold truncate max-w-[200px] sm:max-w-none">{product.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Left Column: Image Gallery */}
          <div>
            <ProductGallery productName={product.name} />
          </div>

          {/* Right Column: Product Info & Actions */}
          <div>
            <ProductInfo product={product} />
          </div>
          
        </div>
        
        {/* Description Tabs (Mocked) */}
        <div className="mt-20 border border-[#E5E4E2] rounded-lg">
           <div className="flex border-b border-[#E5E4E2]">
             <div className="px-8 py-4 text-lg font-bold text-[#1A1A1A] border-b-2 border-blue-600 cursor-pointer">
               Description
             </div>
             <div className="px-8 py-4 text-lg font-bold text-gray-400 hover:text-[#1A1A1A] cursor-pointer">
               Reviews (0)
             </div>
           </div>
           <div className="p-8 text-gray-600 leading-relaxed space-y-4">
             <p>Nam tempus turpis at metus scelerisque placerat nulla deumantos solicitud felis. Pellentesque diam dolor, elementum etos lobortis des mollis ut risus. Sedcus faucibus an sullamcorper mattis drostique des commodo pharetras loremos.Donec pretium egestas sapien et mollis.</p>
             <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum sagittis orci ac odio dictum tincidunt. Donec ut metus leo. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
