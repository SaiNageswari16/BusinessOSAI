import React from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, ShieldCheck, RefreshCw, Scissors, Globe } from "lucide-react";

export function FashionHero() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAFA] py-14 md:py-20 border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Text & Call to Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs font-semibold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>Haute Couture & Ready-To-Wear Edition</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif text-zinc-950 leading-[1.08] tracking-tight">
              Elegance in Form. <br />
              <span className="italic font-normal text-zinc-600">Refined for the modern silhouette.</span>
            </h1>

            <p className="text-base text-zinc-600 max-w-xl leading-relaxed font-sans">
              Discover artisan-tailored apparel, structured silhouettes, and conscious luxury textiles. Every piece crafted with immaculate precision, made to transcend fleeting seasons.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/store/shop"
                className="px-8 py-3.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-sm transition-all shadow-xl shadow-zinc-900/10 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Explore The Lookbook</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/store/shop"
                search={{ filter: "sale" } as any}
                className="px-8 py-3.5 rounded-full bg-white border border-zinc-300 text-zinc-900 font-medium text-sm hover:bg-zinc-50 transition-all cursor-pointer"
              >
                <span>Curated Essentials</span>
              </Link>
            </div>

            {/* 4 Fashion Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-zinc-200">
              <div className="space-y-1">
                <Globe className="w-4 h-4 text-zinc-800" />
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Global Express</div>
                <div className="text-[11px] text-zinc-500">Bespoke door delivery</div>
              </div>

              <div className="space-y-1">
                <Scissors className="w-4 h-4 text-zinc-800" />
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Perfect Fit</div>
                <div className="text-[11px] text-zinc-500">Custom size tailoring</div>
              </div>

              <div className="space-y-1">
                <RefreshCw className="w-4 h-4 text-zinc-800" />
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Concierge Return</div>
                <div className="text-[11px] text-zinc-500">Hassle-free 14 days</div>
              </div>

              <div className="space-y-1">
                <ShieldCheck className="w-4 h-4 text-zinc-800" />
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">100% Authentic</div>
                <div className="text-[11px] text-zinc-500">Designer certified</div>
              </div>
            </div>
          </div>

          {/* Right Visual Lookbook */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[3/4] bg-zinc-200">
              <img
                src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80"
                alt="Vogue Studio Luxury Apparel"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-8 text-white">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#E11D48] text-white">
                    Capsule 04 / Autumn Minimal
                  </span>
                  <h3 className="text-2xl font-serif mt-2">Monochrome Cashmere & Tailored Outerwear</h3>
                  <p className="text-xs text-white/80 mt-1">Available in Limited Production Runs</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
