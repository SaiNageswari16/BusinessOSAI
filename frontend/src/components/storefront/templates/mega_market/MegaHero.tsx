import React from "react";
import { Link } from "@tanstack/react-router";
import { Cpu, Zap, ShieldAlert, Truck, ArrowRight, Laptop, Award, ShieldCheck } from "lucide-react";

export function MegaHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white py-12 md:py-16 border-b border-slate-800">
      <div className="absolute top-0 right-1/4 size-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 size-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Text & Call to Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-wide">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Next-Gen Tech Hub & Authorized Electronics Distributor</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-[1.12] tracking-tight">
              Flagship Tech & Hardware. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400">
                Direct OEM Pricing Guaranteed.
              </span>
            </h1>

            <p className="text-base text-slate-300 max-w-xl leading-relaxed">
              Equip your enterprise or smart home with certified computing systems, networking gear, audio peripherals, and smart accessories. 100% manufacturer warranty and GST credit invoice included.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/store/shop"
                className="px-6 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Shop Tech Inventory</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/store/shop"
                search={{ filter: "sale" } as any}
                className="px-6 py-3.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200 hover:bg-slate-800 font-bold text-sm transition-all shadow-2xs cursor-pointer"
              >
                <span>Daily Flash Deals</span>
              </Link>
            </div>

            {/* 4 Tech Trust Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">100% OEM Certified</div>
                  <div className="text-[10px] text-slate-400">Genuine sealed boxes</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Express Delivery</div>
                  <div className="text-[10px] text-slate-400">Same-day dispatch</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Cpu className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">GST Invoicing</div>
                  <div className="text-[10px] text-slate-400">Input tax credit eligible</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">No-Cost EMI</div>
                  <div className="text-[10px] text-slate-400">All major banks</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual Tech Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-700/60 aspect-[4/3] bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80"
                alt="MegaStore Flagship Tech Gear"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent flex items-end p-6 text-white">
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-600 text-white">
                    Powerhouse Showcase
                  </span>
                  <h3 className="text-xl font-bold mt-1">High Performance Systems & Displays</h3>
                  <p className="text-xs text-slate-300 mt-0.5">Extra ₹2,500 Off with Corporate GST Billing</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
