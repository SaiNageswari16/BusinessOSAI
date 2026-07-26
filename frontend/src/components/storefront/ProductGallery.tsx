import { useState } from "react";

interface ProductGalleryProps {
  productName: string;
}

export function ProductGallery({ productName }: ProductGalleryProps) {
  // Generate 4 mock images based on the product name using Unsplash
  const images = [
    `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName)}`,
    `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName + " detail")}`,
    `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName + " close up")}`,
    `https://source.unsplash.com/random/800x800/?${encodeURIComponent(productName + " box")}`
  ];

  const [selectedImage, setSelectedImage] = useState(images[0]);

  return (
    <div className="flex flex-col-reverse md:flex-row gap-4 sticky top-4">
      {/* Thumbnails (Left side on desktop, bottom on mobile) */}
      <div className="flex md:flex-col gap-2 overflow-x-auto hide-scrollbar">
        {images.map((img, idx) => (
          <button 
            key={idx}
            onClick={() => setSelectedImage(img)}
            className={`flex-shrink-0 w-16 h-16 border-2 rounded-sm overflow-hidden transition-all ${
              selectedImage === img ? 'border-sky-600 ring-1 ring-sky-600' : 'border-[#E5E4E2] hover:border-sky-400'
            }`}
          >
            <img 
              src={img} 
              alt={`Thumbnail ${idx}`} 
              className="w-full h-full object-cover"
              onError={(e) => {
                // fallback
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop";
              }}
            />
          </button>
        ))}
      </div>

      {/* Main Image */}
      <div className="flex-1 border border-[#E5E4E2] rounded-md overflow-hidden bg-white flex items-center justify-center p-4">
        <img 
          src={selectedImage} 
          alt={productName} 
          className="w-full max-h-[500px] object-contain cursor-zoom-in"
          onError={(e) => {
            // fallback
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.src = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop";
          }}
        />
      </div>
    </div>
  );
}
