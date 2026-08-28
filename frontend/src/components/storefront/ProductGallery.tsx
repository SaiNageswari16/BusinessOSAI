import { useState } from "react";
import { Heart } from "lucide-react";
import { useWishlist } from "@/contexts/StoreWishlistContext";

interface ProductGalleryProps {
  productId: string;
  productName: string;
  imageUrl?: string;
}

export function ProductGallery({ productId, productName, imageUrl }: ProductGalleryProps) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWished = isInWishlist(productId);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(productId);
  };

  const images = [
    imageUrl || `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName)}`,
    `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName + " detail")}`,
    `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName + " close up")}`,
    `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName + " box")}`,
  ];

  const [selectedImage, setSelectedImage] = useState(images[0]);

  return (
    <div className="flex flex-col gap-6 sticky top-4">
      {/* Main Image */}
      <div className="relative w-full h-[350px] md:h-[500px] bg-[#f2f4f5] rounded-2xl overflow-hidden flex items-center justify-center p-0">
        <img
          src={selectedImage}
          alt={productName}
          className="w-full h-full object-cover mix-blend-multiply cursor-zoom-in transition-transform duration-500 hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.src =
              "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop";
          }}
        />
      </div>

      {/* Thumbnails */}
      <div className="flex gap-4 overflow-x-auto py-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedImage(img)}
            className={`flex-shrink-0 w-24 h-24 bg-[#f2f4f5] rounded-xl overflow-hidden transition-all flex items-center justify-center p-0 box-border ${
              selectedImage === img
                ? "border-2 border-[#003d29] shadow-sm"
                : "border-2 border-transparent hover:border-gray-300"
            }`}
          >
            <img
              src={img}
              alt={`Thumbnail ${idx}`}
              className="w-full h-full object-cover mix-blend-multiply"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src =
                  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop";
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
