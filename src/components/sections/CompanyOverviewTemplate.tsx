"use client";

import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { AboutUsSection } from "@/components/sections/AboutUsSection";
import WhyChooseUs01Finsyc from "@/components/sections/WhyChooseUs01Finsyc";
import { TrustedBrandBlack } from "@/components/sections/TrustedBrandBlack";

export function CompanyOverviewTemplate() {
  return (
    <div className="w-full bg-[#f8f9fb] text-zinc-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      {/* Breadcrumb Navigation & Route Header */}
      <div className="bg-white border-b border-zinc-200/80 px-4 sm:px-6 2xl:px-12 py-3.5">
        <div className="max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] mx-auto flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Link to="/" className="hover:text-purple-700 transition-colors">
              Home
            </Link>
            <ChevronRight className="size-3.5 text-zinc-400" />
            <Link to="/about" className="hover:text-purple-700 transition-colors">
              About
            </Link>
            <ChevronRight className="size-3.5 text-zinc-400" />
            <span className="font-bold text-purple-700 font-mono">Company Overview</span>
          </div>

          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Return to About Main Page</span>
          </Link>
        </div>
      </div>

      {/* Migrated Complete Original About Page Section */}
      <AboutUsSection />

      {/* Strategic Advantages / Why Choose Us */}
      <WhyChooseUs01Finsyc />

      {/* Enterprise Brands / Marquee */}
      <TrustedBrandBlack />

      {/* Bottom CTA to explore new About story */}
      <section className="py-12 px-4 sm:px-6 2xl:px-12 bg-white border-t border-zinc-200/80">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-8 text-center space-y-4 shadow-xl">
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/30 font-mono">
            COMPANY HORIZONS
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
            Want to explore our strategic vision &amp; leadership?
          </h3>
          <p className="text-xs sm:text-sm text-purple-200 max-w-xl mx-auto">
            Discover our engineering DNA, core values, and global presence on our main About page.
          </p>
          <div className="pt-2">
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-xl bg-white text-purple-900 font-bold px-6 py-3 text-xs shadow-md hover:bg-purple-50 transition-all hover:scale-105"
            >
              <span>Visit Main About Page</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CompanyOverviewTemplate;
