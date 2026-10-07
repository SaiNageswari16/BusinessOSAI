"use client";

import React from "react";
import {
  CodeXml,
  Sliders,
  Database,
  Users,
  Zap,
  Sparkles,
  ArrowRight,
  Puzzle,
  Cpu,
  Bot
} from "lucide-react";
import { Link } from "@tanstack/react-router";

interface CustomizationCellProps {
  icon: React.ElementType;
  title: string;
  body: string;
  index: number;
}

function CustomizationCell({
  icon: Icon,
  title,
  body,
  index,
}: CustomizationCellProps) {
  return (
    <div className="group relative flex flex-col items-center justify-center text-center p-10 md:p-14 h-full overflow-hidden cursor-default transition-all duration-500 hover:-translate-y-1.5">
      {/* Spotlight Glow on Hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/8 via-indigo-500/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      {/* Permanent Looping Conic Gradient Beam with CSS Mask */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            padding: "1px",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          } as React.CSSProperties}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] opacity-35 group-hover:opacity-100 transition-opacity duration-500 animate-spin"
            style={{
              animationDuration: "8s",
              animationDelay: `${index * 0.6}s`,
              background:
                "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 280deg, rgba(147,51,234,0.3) 360deg)",
            }}
          />
        </div>
      </div>

      {/* Cell Content */}
      <div className="relative z-10 flex flex-col items-center transition-transform duration-500 group-hover:-translate-y-1">
        <div className="w-[54px] h-[54px] bg-purple-50 border border-purple-200/80 rounded-[14px] flex items-center justify-center mb-6 group-hover:bg-gradient-to-br group-hover:from-purple-600 group-hover:to-indigo-600 group-hover:shadow-[0_0_20px_rgba(147,51,234,0.3)] group-hover:border-purple-400 transition-all duration-500 text-purple-600 group-hover:text-white shadow-xs">
          <Icon size={24} strokeWidth={1.75} />
        </div>
        <h3 className="text-slate-950 text-[22px] font-bold leading-[28px] tracking-tight mb-2.5 group-hover:text-purple-700 transition-colors duration-500">
          {title}
        </h3>
        <p className="text-slate-600 text-[15px] font-normal leading-[24px] max-w-[290px] group-hover:text-slate-800 transition-colors duration-500">
          {body}
        </p>
      </div>
    </div>
  );
}

export function CustomizationSection({ className }: { className?: string }) {
  const customizationCapabilities = [
    {
      icon: CodeXml,
      title: "Bespoke ERP & POS Modules",
      body: "Custom billing algorithms, specialized landed costing, and unique barcode schema built for your exact workflow.",
    },
    {
      icon: Sliders,
      title: "Hardware & IoT Telemetry",
      body: "Plug-and-play drivers for physical turnstile gates, biometric terminals, ESC/POS printers, and temperature sensors.",
    },
    {
      icon: Database,
      title: "Legacy & Enterprise Sync",
      body: "Two-way automated sync with SAP, Tally Prime, Salesforce, Shopify, and custom legacy SQL databases.",
    },
    {
      icon: Users,
      title: "Multi-Tenant RBAC Security",
      body: "Custom approval hierarchies, multi-branch control towers, and cryptographic tenant isolation.",
    },
    {
      icon: Zap,
      title: "Automated WhatsApp Bot Engine",
      body: "1-Click UPI payment links, automated dues alerts, and service lifecycle rebooking triggers.",
    },
    {
      icon: Bot,
      title: "Domain-Specific AI Copilots",
      body: "Fine-tune localized LLM models on your historical sales catalogs, inventory records, and SOP guidelines.",
    },
  ];

  return (
    <section
      id="customization"
      className={
        "w-full bg-[#f8f9fa] py-20 sm:py-28 px-4 sm:px-6 md:px-12 font-sans overflow-hidden border-t border-slate-200/90 relative " +
        (className || "")
      }
    >
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Section Header */}
      <div className="max-w-4xl mx-auto text-center mb-16 sm:mb-20 relative z-10 space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-purple-700 shadow-xs">
          <Sparkles className="size-3.5 text-purple-600" /> Bespoke Engineering
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight">
          Engineered to Match Your{" "}
          <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Unique Enterprise Scale
          </span>
        </h2>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-normal">
          No rigid software templates. We custom-engineer applications, hardware bridges, and automated workflows tailored precisely to your operational requirements.
        </p>
      </div>

      {/* Audience / Customization Grid with Masked Border Beams */}
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 relative border border-slate-200/90 rounded-3xl bg-white shadow-sm overflow-hidden">
          {customizationCapabilities.map((item, idx) => (
            <div key={item.title} className="relative border-b md:border-b-0 md:border-r border-slate-200/80 last:border-0">
              <CustomizationCell
                icon={item.icon}
                title={item.title}
                body={item.body}
                index={idx}
              />
            </div>
          ))}
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-12 text-center">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 px-7 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md hover:shadow-purple-500/25 transition-all hover:scale-105"
          >
            Request a Custom Engineering Scope <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
