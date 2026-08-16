import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const images = [
  "https://images.unsplash.com/photo-1607082349566-187342175e2f?q=80&w=1600&auto=format&fit=crop", // generic e-commerce
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1600&auto=format&fit=crop", // fashion
  "https://images.unsplash.com/photo-1550009158-9ebf6d973144?q=80&w=1600&auto=format&fit=crop", // electronics
];

export function HeroCarousel() {
    const { currency, formatCurrency } = useCurrency();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  const next = () => setCurrentIndex((prev) => (prev + 1) % images.length);

  return (
    <div className="relative w-full h-[600px] overflow-hidden">
      {/* Images container */}
      <div 
        className="flex transition-transform duration-500 ease-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((src, idx) => (
          <img 
            key={idx} 
            src={src} 
            alt={`Banner ${idx}`} 
            className="w-full h-full object-cover flex-shrink-0"
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      <button 
        onClick={prev}
        className="absolute top-1/3 left-0 bg-transparent hover:border-2 border-white px-2 py-8 rounded-r-md transition-all focus:outline-none"
      >
        <ChevronLeft className="h-10 w-10 text-white drop-shadow-md" />
      </button>

      <button 
        onClick={next}
        className="absolute top-1/3 right-0 bg-transparent hover:border-2 border-white px-2 py-8 rounded-l-md transition-all focus:outline-none"
      >
        <ChevronRight className="h-10 w-10 text-white drop-shadow-md" />
      </button>
    </div>
  );
}
