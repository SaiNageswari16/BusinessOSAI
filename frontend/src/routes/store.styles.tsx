import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, Check, Heart, ShoppingBag, Star, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/store/styles")({
  component: StylesGuidePage,
});

function StylesGuidePage() {
  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Design System & Style Guide
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Styles</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl space-y-12">
        {/* Colors */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-gray-900 font-organic-heading">Color Palette</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
            <div className="p-5 rounded-2xl bg-[#6BB252] text-white space-y-1 shadow-sm">
              <span>Primary Green</span>
              <span className="block font-mono text-[11px] opacity-80">#6BB252</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#364127] text-white space-y-1 shadow-sm">
              <span>Secondary Dark</span>
              <span className="block font-mono text-[11px] opacity-80">#364127</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#F95F09] text-white space-y-1 shadow-sm">
              <span>Accent Orange</span>
              <span className="block font-mono text-[11px] opacity-80">#F95F09</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#FAF8EF] text-gray-800 border border-gray-200 space-y-1 shadow-sm">
              <span>Organic Cream</span>
              <span className="block font-mono text-[11px] text-gray-500">#FAF8EF</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-gray-900 font-organic-heading">Buttons & Controls</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <button className="bg-[#6BB252] hover:bg-[#5ba342] text-white font-bold text-xs px-6 py-3 rounded-full transition-all cursor-pointer">
              Primary Button
            </button>
            <button className="bg-[#222222] hover:bg-black text-white font-bold text-xs px-6 py-3 rounded-full transition-all cursor-pointer">
              Dark Button
            </button>
            <button className="bg-white border-2 border-gray-200 hover:border-gray-400 text-gray-800 font-bold text-xs px-6 py-3 rounded-full transition-all cursor-pointer">
              Outlined Button
            </button>
            <button className="bg-[#F95F09] hover:bg-[#e04f02] text-white font-bold text-xs px-6 py-3 rounded-full transition-all cursor-pointer">
              Accent Button
            </button>
          </div>
        </div>

        {/* Badges & Tags */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-gray-900 font-organic-heading">Badges & Tags</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="bg-[#F95F09] text-white text-[11px] font-extrabold px-3 py-1 rounded-full uppercase">
              25% OFF
            </span>
            <span className="bg-[#f0f7ed] text-[#6BB252] text-[11px] font-bold px-3 py-1 rounded-full">
              Fresh Harvest
            </span>
            <span className="bg-[#FAF8EF] text-gray-700 border border-gray-200 text-[11px] font-bold px-3 py-1 rounded-md">
              Unit: 500g
            </span>
            <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-3 py-1 rounded-md flex items-center gap-1">
              <Check className="size-3" /> In Stock
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
