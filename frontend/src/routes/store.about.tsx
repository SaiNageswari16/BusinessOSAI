import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, Award, Heart, ShieldCheck, Truck, Users, Leaf, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/store/about")({
  component: AboutUsPage,
});

function AboutUsPage() {
  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            About Organic
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">About Us</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 space-y-16 max-w-5xl">
        {/* Story Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#6BB252] bg-[#f0f7ed] px-3 py-1 rounded-full">
              Our Journey
            </span>
            <h2 className="text-3xl font-black text-gray-900 font-organic-heading leading-tight">
              Pure, wholesome food cultivated in harmony with nature.
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Founded with the vision to restore clean, nutrient-dense nutrition to family tables, Organic
              partners directly with verified regional smallholders. We eliminate intermediaries, ensuring
              fair compensation for growers and uncompromised freshness for your kitchen.
            </p>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Every apple, bunch of baby spinach, and loaf of stoneground whole wheat is inspected for quality
              and tested to ensure zero synthetic chemicals or pesticide residues.
            </p>
          </div>

          <div className="rounded-3xl overflow-hidden shadow-lg border border-gray-100 aspect-[4/3]">
            <img
              src="/organic/images/category-thumb-1.jpg"
              alt="Organic farm harvesting"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* 4 Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-[#FAF8EF] border border-gray-100 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#6BB252] flex items-center justify-center mx-auto shadow-2xs">
              <Leaf className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">100% Certified</h3>
            <p className="text-xs text-gray-500">Rigorous organic inspections at every agricultural tier.</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8EF] border border-gray-100 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#6BB252] flex items-center justify-center mx-auto shadow-2xs">
              <Truck className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">Cold Chain Logistics</h3>
            <p className="text-xs text-gray-500">Chilled transport protecting delicate vitamins and flavor.</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8EF] border border-gray-100 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#6BB252] flex items-center justify-center mx-auto shadow-2xs">
              <Heart className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">Community Health</h3>
            <p className="text-xs text-gray-500">Committed to promoting sustainable organic lifestyles.</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAF8EF] border border-gray-100 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#6BB252] flex items-center justify-center mx-auto shadow-2xs">
              <Users className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">Ethical Sourcing</h3>
            <p className="text-xs text-gray-500">Fair trade pricing that supports local farmer livelihoods.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-3xl bg-[#6BB252] text-white p-8 md:p-12 text-center space-y-4">
          <h3 className="text-2xl sm:text-3xl font-black font-organic-heading">
            Experience the natural taste of clean organic harvest
          </h3>
          <p className="text-xs sm:text-sm text-white/90 max-w-lg mx-auto">
            Order before 2:00 PM for guaranteed same-day dispatch right to your kitchen doorstep.
          </p>
          <Link
            to="/store/shop"
            className="inline-flex items-center gap-2 bg-white text-[#6BB252] hover:bg-gray-100 px-8 py-3.5 rounded-full text-xs font-bold transition-all shadow-md"
          >
            Explore Product Catalog <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
