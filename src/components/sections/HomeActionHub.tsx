"use client";

import React from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  ArrowRight,
  Laptop,
  Send,
  Building2,
  Layers,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ChevronRight,
  Server,
  Zap,
} from "lucide-react";

export function HomeActionHub({ className }: { className?: string }) {
  const pathways = [
    {
      title: "Schedule a Live Demo",
      description: "Experience a hands-on 30-minute walkthrough populated with your industry data in a live sandbox.",
      icon: Laptop,
      badge: "Interactive Walkthrough",
      actionText: "Request 30-Min Demo",
      to: "/contact/request-demo",
      primary: true,
    },
    {
      title: "Enterprise Solutions & Consultation",
      description: "Consult with a senior systems architect on custom ERP integrations, multi-branch scaling, and SLA terms.",
      icon: Send,
      badge: "Architecture Advisory",
      actionText: "Open Contact Portal",
      to: "/contact",
      primary: false,
    },
    {
      title: "Explore Application Catalog",
      description: "Review detailed feature deep-dives, hardware peripheral drivers, and screenshots across all vertical operating systems.",
      icon: Layers,
      badge: "Product Deep-Dives",
      actionText: "Browse Applications",
      to: "/products/ai-business-os",
      primary: false,
    },
    {
      title: "Our Story & Global Footprint",
      description: "Discover the founding thesis, engineering philosophy, and international delivery centers behind IOTRONICS.",
      icon: Building2,
      badge: "Company Journey",
      actionText: "Read About Us",
      to: "/about",
      primary: false,
    },
  ];

  return (
    <section
      id="action-hub"
      className={
        "w-full bg-[#f8fafd] text-slate-900 font-sans relative overflow-hidden border-t border-slate-200/80 py-8 sm:py-10 md:py-12 " +
        (className || "")
      }
    >
      <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] relative z-10">
        {/* Top Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-50 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono shadow-xs mb-2.5">
            <Sparkles className="size-3.5 text-purple-600" />
            <span>ACCELERATE YOUR ENTERPRISE &bull; STRATEGIC NEXT STEPS</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl 2xl:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
            Your Next Business Transformation{" "}
            <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
              Starts Here.
            </span>
          </h2>

          <p className="mt-2 text-xs sm:text-sm 2xl:text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
            Choose the engagement path that best aligns with your timeline. Whether evaluating a single flagship location or preparing a nationwide rollout, our team is equipped to assist.
          </p>
        </div>

        {/* 4 Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          {pathways.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 flex flex-col justify-between group ${
                  item.primary
                    ? "bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-900 text-white border-purple-800/50 shadow-md hover:scale-[1.02]"
                    : "bg-white text-slate-900 border-slate-200/90 shadow-2xs hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`size-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        item.primary
                          ? "bg-purple-800/50 text-purple-200 border border-purple-700/50"
                          : "bg-purple-50 text-purple-700 border border-purple-200/60"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full font-mono ${
                        item.primary
                          ? "bg-purple-500/20 text-purple-300 border border-purple-400/30"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <h3
                    className={`text-base font-bold tracking-tight mb-2 ${
                      item.primary ? "text-white" : "text-slate-950"
                    }`}
                  >
                    {item.title}
                  </h3>

                  <p
                    className={`text-xs leading-relaxed font-normal ${
                      item.primary ? "text-purple-200/90" : "text-slate-600"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100/20">
                  <Link
                    to={item.to}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                      item.primary
                        ? "bg-white text-purple-950 hover:bg-purple-50 shadow-sm"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                    }`}
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Trust Footer Strip */}
        <div className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span>Enterprise Security &amp; Assurance</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-purple-600" /> SOC-2 Ready
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="size-3.5 text-indigo-600" /> 99.99% Uptime SLA
            </span>
            <span className="flex items-center gap-1.5">
              <Server className="size-3.5 text-pink-600" /> 1.5M+ Daily Transactions
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-emerald-600" /> &lt; 2-Hour Architect Response
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeActionHub;

