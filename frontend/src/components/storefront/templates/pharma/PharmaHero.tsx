import React from "react";
import { Link } from "@tanstack/react-router";
import { Pill, ShieldCheck, FileText, Clock, Truck, Award, Sparkles, Stethoscope, ArrowRight } from "lucide-react";

export function PharmaHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F0F9FF] via-[#E0F2FE] to-[#F0F9FF] py-12 md:py-16 border-b border-[#BAE6FD]">
      <div className="absolute top-0 right-10 size-96 rounded-full bg-[#0284C7]/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 size-80 rounded-full bg-[#0D9488]/8 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E0F2FE] border border-[#7DD3FC] text-[#0369A1] text-xs font-bold tracking-wide">
              <Stethoscope className="w-4 h-4 text-[#0284C7]" />
              <span>WHO-GMP & FDA Certified Pharmacy Network</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0F172A] leading-[1.12]">
              Genuine Medicines & Daily Wellness At Your Doorstep.
            </h1>

            <p className="text-base text-[#475569] max-w-xl leading-relaxed">
              Order prescription medicines, chronic disease management refills, immunity supplements, and medical devices. Backed by verified pharmacist checks and temperature-controlled delivery.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/store/shop"
                className="px-6 py-3.5 rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-sm transition-all shadow-lg shadow-[#0284C7]/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Browse Medicines</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <button
                type="button"
                onClick={() => alert("Upload Prescription: Please attach your doctor's valid prescription to proceed with pharmacist verification.")}
                className="px-6 py-3.5 rounded-full bg-white border border-[#0284C7] text-[#0284C7] hover:bg-[#F0F9FF] font-bold text-sm transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Upload Prescription</span>
              </button>
            </div>

            {/* 4 Pharma Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-[#BAE6FD]/60">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">100% Genuine</div>
                  <div className="text-[10px] text-[#64748B]">Batch QR verified</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-[#0D9488] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Cold-Chain Safe</div>
                  <div className="text-[10px] text-[#64748B]">Insulin & vaccines</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Fast Delivery</div>
                  <div className="text-[10px] text-[#64748B]">Under 2 hours</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Award className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Free Pharmacist</div>
                  <div className="text-[10px] text-[#64748B]">Prescription review</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] bg-[#E0F2FE]">
              <img
                src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80"
                alt="MedPlus Certified Healthcare & Pharmacy"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-6 text-white">
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#0284C7] text-white">
                    Verified Healthcare
                  </span>
                  <h3 className="text-xl font-bold mt-1">Essential Care Refills & Vitamins</h3>
                  <p className="text-xs text-white/80 mt-0.5">Flat 20% OFF on Monthly Chronic Medication</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
