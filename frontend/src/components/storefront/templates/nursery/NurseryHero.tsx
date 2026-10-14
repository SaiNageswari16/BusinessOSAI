import React from "react";
import { Link } from "@tanstack/react-router";
import { Sprout, ShieldCheck, Sun, Droplets, ArrowRight, Sparkles, HeartHandshake, PackageCheck } from "lucide-react";

export function NurseryHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FAF8F5] via-[#F2ECE1] to-[#FAF8F5] py-12 md:py-16 border-b border-[#E6E0D5]">
      {/* Decorative botanical blur orbs */}
      <div className="absolute top-0 right-10 size-96 rounded-full bg-[#1B4D3E]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 size-80 rounded-full bg-[#C25E3E]/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text & Call to Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F3EE] border border-[#C5E1D4] text-[#1B4D3E] text-xs font-bold tracking-wide">
              <Sprout className="w-4 h-4 text-[#16A34A]" />
              <span>Direct From Certified Organic Nurseries</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1B4D3E] leading-[1.15] font-serif">
              Bring Living Nature Indoors With Curated Botanicals.
            </h1>

            <p className="text-base text-[#4A6B5D] max-w-xl leading-relaxed">
              Air-purifying houseplants, handcrafted ceramic planters, and nutrient-rich organic soils. Every plant is acclimatized, pest-checked, and safely shipped with a 7-day health guarantee.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/store/shop"
                className="px-6 py-3.5 rounded-full bg-[#1B4D3E] text-white font-bold text-sm hover:bg-[#153D31] transition-all shadow-lg shadow-[#1B4D3E]/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Shop Living Plants</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/store/shop"
                search={{ category: "Pots & Planters" } as any}
                className="px-6 py-3.5 rounded-full bg-white border border-[#D5CDC0] text-[#1B4D3E] font-bold text-sm hover:bg-[#FAF8F5] transition-all shadow-2xs cursor-pointer"
              >
                <span>Browse Ceramic Planters</span>
              </Link>
            </div>

            {/* 4 Trust Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-[#E6E0D5]/80">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#1B4D3E]">7-Day Transit Guarantee</div>
                  <div className="text-[10px] text-[#6E8A7D]">Guaranteed healthy arrival</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Sun className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#1B4D3E]">Plant Care Manual</div>
                  <div className="text-[10px] text-[#6E8A7D]">Sunlight & water card</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <PackageCheck className="w-5 h-5 text-[#C25E3E] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#1B4D3E]">Eco Breathable Box</div>
                  <div className="text-[10px] text-[#6E8A7D]">100% recyclable wrap</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <HeartHandshake className="w-5 h-5 text-[#1B4D3E] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#1B4D3E]">Doctor Consultation</div>
                  <div className="text-[10px] text-[#6E8A7D]">Lifetime garden advice</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Hero Visual Cards */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] bg-[#E8F3EE]">
              <img
                src="https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80"
                alt="GreenFlora Nursery Plants"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-6 text-white">
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#16A34A] text-white">
                    Seasonal Spotlight
                  </span>
                  <h3 className="text-xl font-bold mt-1 font-serif">Monstera Deliciosa & Fiddle Leaf</h3>
                  <p className="text-xs text-white/80 mt-0.5">Includes Handcrafted Terracotta Pot</p>
                </div>
              </div>
            </div>

            {/* Floating Mini Badge */}
            <div className="absolute -bottom-4 -left-4 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-[#E6E0D5] flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#E8F3EE] text-[#16A34A] flex items-center justify-center">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-[#1B4D3E]">Easy Care Plants</div>
                <div className="text-[10px] text-[#6E8A7D]">Low water • Thrives indoors</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
