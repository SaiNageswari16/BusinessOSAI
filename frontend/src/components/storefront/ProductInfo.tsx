import { StorefrontProduct } from "@/lib/storefront-api";
import { Star, ShoppingBag, Heart, Share2, Check } from "lucide-react";
import { useState } from "react";
import { useStoreCart } from "@/contexts/StoreCartContext";

interface ProductInfoProps {
  product: StorefrontProduct;
}

export function ProductInfo({ product }: ProductInfoProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants && product.variants.length > 0 ? product.variants[0].id : null
  );
  const [mainImage, setMainImage] = useState<string | undefined>(product.image_url);

  const { addToCart } = useStoreCart();

  const selectedVariant = product.variants?.find(v => v.id === selectedVariantId);
  
  // Calculate price based on variant
  const finalPrice = product.selling_price + (selectedVariant ? selectedVariant.additional_price : 0);

  const handleAddToCart = () => {
    addToCart({
      id: product.id + (selectedVariant ? `-${selectedVariant.id}` : ''),
      name: product.name + (selectedVariant ? ` (${selectedVariant.variant_name})` : ''),
      price: finalPrice,
      mrp: product.mrp,
      image_url: mainImage || product.image_url,
      category_name: product.category_name,
      brand: product.brand,
      stock: selectedVariant?.stock_override !== null ? selectedVariant?.stock_override : product.stock,
    }, quantity);
  };

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => q > 1 ? q - 1 : 1);

  const allImages = [
    ...(product.image_url ? [{ id: 'main', url: product.image_url }] : []),
    ...(product.images || []).map(img => ({ id: img.id, url: img.image_url }))
  ];

  return (
    <div className="flex flex-col space-y-6">
      
      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] leading-tight">
        {product.name}
      </h1>

      {/* Ratings & Brand */}
      <div className="flex items-center space-x-6 text-sm text-gray-500">
        <div className="flex items-center">
           <div className="flex text-[#FFA41C] mr-2">
             {'★★★★★'}
           </div>
           (12 reviews)
        </div>
        {product.brand && (
          <div className="border-l border-gray-300 pl-6">
             Brand: <span className="text-blue-600 font-bold">{product.brand}</span>
          </div>
        )}
      </div>

      {/* Price */}
      <div className="py-2 border-b border-gray-100 pb-6">
        <div className="flex items-end space-x-3">
          <span className="text-4xl font-bold text-blue-600">{finalPrice.toFixed(2)} KWD</span>
          {product.mrp > finalPrice && (
            <span className="text-lg text-gray-400 line-through">{product.mrp.toFixed(2)} KWD</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-2">Tax included. Delivery calculated at checkout.</p>
      </div>

      {/* Mini Image Gallery (if more than 1 image) */}
      {allImages.length > 1 && (
        <div className="flex space-x-2 py-2">
          {allImages.map(img => (
            <img 
              key={img.id}
              src={img.url} 
              alt={product.name}
              onClick={() => setMainImage(img.url)}
              className={`w-16 h-16 object-cover rounded-md cursor-pointer border-2 ${mainImage === img.url ? 'border-blue-600' : 'border-transparent opacity-70 hover:opacity-100'}`}
            />
          ))}
        </div>
      )}
      
      {/* Short Description */}
      <p className="text-gray-600 leading-relaxed">
        {product.short_description || "Premium quality organic product sourced directly for you. Experience the freshest ingredients and finest materials, carefully selected to ensure your utmost satisfaction. Perfect for everyday use."}
      </p>

      {/* Variants */}
      {product.variants && product.variants.length > 0 && (
        <div className="pt-2">
          <h3 className="font-bold text-[#1A1A1A] mb-3">Options:</h3>
          <div className="flex flex-wrap gap-2">
            {product.variants.map(variant => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariantId(variant.id)}
                className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                  selectedVariantId === variant.id 
                  ? 'border-blue-600 bg-blue-600 text-white' 
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {variant.variant_name}
                {variant.additional_price > 0 && ` (+${variant.additional_price} KWD)`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stock Status */}
      <div className="flex items-center text-blue-600 font-bold">
        <Check className="w-5 h-5 mr-2" />
        {selectedVariant?.stock_override ?? product.stock} In stock
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-4 pt-4">
        {/* Quantity */}
        <div className="flex items-center border border-[#E5E4E2] rounded-full h-12">
          <button onClick={decrement} className="px-4 text-gray-500 hover:text-blue-600 transition-colors">-</button>
          <span className="w-8 text-center font-bold text-[#1A1A1A]">{quantity}</span>
          <button onClick={increment} className="px-4 text-gray-500 hover:text-blue-600 transition-colors">+</button>
        </div>

        {/* Add to Cart */}
        <button 
          onClick={handleAddToCart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-full transition-colors flex items-center justify-center uppercase tracking-wide"
        >
          <ShoppingBag className="w-5 h-5 mr-2" />
          Add to Cart
        </button>

        {/* Wishlist */}
        <button className="w-12 h-12 flex items-center justify-center border border-[#E5E4E2] rounded-full text-gray-500 hover:border-blue-600 hover:text-blue-600 transition-colors">
          <Heart className="w-5 h-5" />
        </button>
      </div>

      {/* Meta */}
      <div className="pt-6 border-t border-gray-100 space-y-3 text-sm text-gray-500">
        <div><span className="font-bold text-[#1A1A1A] w-24 inline-block">SKU:</span> {selectedVariant?.sku || product.sku}</div>
        {product.category_name && (
          <div><span className="font-bold text-[#1A1A1A] w-24 inline-block">Category:</span> {product.category_name}</div>
        )}
        <div className="flex items-center">
          <span className="font-bold text-[#1A1A1A] w-24 inline-block">Share:</span>
          <div className="flex space-x-3 text-gray-400">
            <Share2 className="w-4 h-4 cursor-pointer hover:text-blue-600" />
          </div>
        </div>
      </div>

    </div>
  );
}
