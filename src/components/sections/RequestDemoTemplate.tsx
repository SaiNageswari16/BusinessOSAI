"use client";

import React from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  Headphones,
} from "lucide-react";
import { ContactSection } from "@/components/sections/ContactSection";

export function RequestDemoTemplate() {
  return (
    <div className="w-full bg-[#f8f9fa] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      {/* Breadcrumb Navigation & Route Header */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 2xl:px-12 py-3.5 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] mx-auto flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Link to="/" className="hover:text-purple-700 transition-colors">
              Home
            </Link>
            <ChevronRight className="size-3.5 text-slate-400" />
            <Link to="/contact" className="hover:text-purple-700 transition-colors">
              Contact
            </Link>
            <ChevronRight className="size-3.5 text-slate-400" />
            <span className="font-bold text-purple-700 font-mono">Request a Demo</span>
          </div>

          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Return to Contact Portal</span>
          </Link>
        </div>
      </div>

      {/* Trust & Demo Guarantee Highlights Bar */}
      <div className="bg-purple-50/60 border-b border-purple-100 py-3 px-4 sm:px-6">
        <div className="max-w-7xl 2xl:max-w-[1560px] mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-4 text-xs font-medium text-slate-700">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-purple-600" />
            <span><strong>30-Minute Live Walkthrough:</strong> Custom demonstration tailored to your exact industry.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <ShieldCheck className="size-4 text-emerald-600" /> SOC-2 Ready
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <Lock className="size-4 text-purple-600" /> Zero Obligation NDA
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <CheckCircle2 className="size-4 text-indigo-600" /> Live Sandbox
            </span>
          </div>
        </div>
      </div>

      {/* Migrated Complete Original Contact Page Section */}
      <ContactSection />

      {/* Bottom Exploration Banner linking to the new Contact Portal */}
      <section className="py-12 px-4 sm:px-6 2xl:px-12 bg-white border-t border-slate-200/80">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white p-8 sm:p-10 text-center space-y-4 shadow-xl">
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/30 font-mono">
            COMPREHENSIVE CONTACT PORTAL
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
            Need Enterprise Solutions, Custom Development, or Partnerships?
          </h3>
          <p className="text-xs sm:text-sm text-purple-200 max-w-xl mx-auto leading-relaxed">
            Visit our main Contact Portal to explore specialized enquiry channels, application-specific consultations, engagement timelines, and answers to technical FAQs.
          </p>
          <div className="pt-2">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-white text-purple-900 font-bold px-6 py-3 text-xs sm:text-sm shadow-md hover:bg-purple-50 transition-all hover:scale-105"
            >
              <span>Explore Contact Portal</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default RequestDemoTemplate;

