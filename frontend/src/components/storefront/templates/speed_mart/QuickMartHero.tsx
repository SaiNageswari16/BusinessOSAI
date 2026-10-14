import React from "react";
import { Link } from "@tanstack/react-router";
import { Zap, Clock, ShieldCheck, ArrowRight, ShoppingBag, Sparkles, Flame } from "lucide-react";

export function QuickMartHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-[#4C1D95] via-[#5B21B6] to-[#7C3AED] text-white py-10 md:py-14 border-b border-purple-800">
      <div className="absolute top-0 right-10 size-80 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 size-72 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Text & Call to Actions */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400 text-purple-950 text-xs font-black tracking-wide shadow-md">
              <Zap className="w-4 h-4 fill-current text-purple-950" />
              <span>LIGHTNING SPEED • 10-MINUTE INSTANT COMMERCE</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.12]">
              Instant Munchies, Fresh Groceries & Everyday Needs.
            </h1>

            <p className="text-sm sm:text-base text-purple-100 max-w-xl leading-relaxed">
              Order daily milk, bakery treats, cold beverages, ice creams, fresh vegetables and urgent household items delivered to your doorstep in 10 minutes flat!
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/store/shop"
                className="px-6 py-3.5 rounded-full bg-amber-400 hover:bg-amber-300 text-purple-950 font-black text-sm transition-all shadow-lg shadow-amber-400/30 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Order In 10 Mins</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/store/shop"
                search={{ filter: "sale" } as any}
                className="px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4 text-amber-300" />
                <span>Midnight Deals</span>
              </Link>
            </div>

            {/* 4 Quick Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-purple-600/40">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">10 Min Promise</div>
                  <div className="text-[10px] text-purple-200">Hyperlocal darkstores</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">No Min. Order</div>
                  <div className="text-[10px] text-purple-200">From ₹10 onwards</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Instant Return</div>
                  <div className="text-[10px] text-purple-200">Immediate refund</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Chilled Fresh</div>
                  <div className="text-[10px] text-purple-200">Cold pack guaranteed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual Quick Mart Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-purple-400/30 aspect-[4/3] bg-purple-900">
              <img
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80"
                alt="ExpressMart 10-Minute Delivery"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-950 via-purple-950/40 to-transparent flex items-end p-6 text-white">
                <div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-purple-950">
                    ⚡ 8 Mins Away from you
                  </span>
                  <h3 className="text-xl font-bold mt-1">Farm Fresh Greens & Snack Bar</h3>
                  <p className="text-xs text-purple-200 mt-0.5">Free Delivery on orders above ₹99</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
