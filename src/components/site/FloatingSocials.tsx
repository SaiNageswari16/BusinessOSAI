"use client";

import React, { useState } from "react";
import {
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Share2,
  X,
} from "lucide-react";

// Modern X (Twitter) SVG Icon
function XIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// WhatsApp SVG Icon
function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.888 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface SocialLink {
  name: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hoverClass: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "X (Twitter)",
    label: "Follow on X",
    href: "https://twitter.com",
    icon: XIcon,
    hoverClass:
      "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:shadow-black/20",
  },
  {
    name: "Instagram",
    label: "Follow on Instagram",
    href: "https://instagram.com",
    icon: Instagram,
    hoverClass:
      "hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] hover:text-white hover:shadow-pink-500/30",
  },
  {
    name: "LinkedIn",
    label: "Connect on LinkedIn",
    href: "https://linkedin.com",
    icon: Linkedin,
    hoverClass: "hover:bg-[#0A66C2] hover:text-white hover:shadow-blue-600/30",
  },
  {
    name: "Facebook",
    label: "Follow on Facebook",
    href: "https://facebook.com",
    icon: Facebook,
    hoverClass: "hover:bg-[#1877F2] hover:text-white hover:shadow-blue-500/30",
  },
  {
    name: "WhatsApp",
    label: "Chat on WhatsApp",
    href: "https://api.whatsapp.com/send",
    icon: WhatsAppIcon,
    hoverClass: "hover:bg-[#25D366] hover:text-white hover:shadow-emerald-500/30",
  },
  {
    name: "YouTube",
    label: "Subscribe on YouTube",
    href: "https://youtube.com",
    icon: Youtube,
    hoverClass: "hover:bg-[#FF0000] hover:text-white hover:shadow-red-500/30",
  },
];

export function FloatingSocials() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* 1. Desktop Fixed Vertical Dock (Visible only on md screens and above) */}
      <aside
        aria-label="Floating Social Media Links"
        className="hidden md:flex fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-50 flex-col items-center select-none"
      >
        <div className="flex flex-col items-center gap-2 p-1.5 sm:p-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.18)] transition-all duration-300 hover:shadow-[0_14px_45px_-5px_rgba(0,0,0,0.25)]">
          {SOCIAL_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                className={`relative group flex items-center justify-center size-9 sm:size-10 rounded-full text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/70 transition-all duration-200 hover:scale-110 active:scale-95 shadow-2xs ${item.hoverClass}`}
              >
                <Icon className="size-4 sm:size-4.5 transition-transform duration-200 group-hover:scale-105" />

                {/* Tooltip on hover */}
                <span className="absolute right-full mr-3.5 px-2.5 py-1 rounded-md bg-slate-950 text-white text-[11px] font-bold tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 pointer-events-none shadow-xl border border-white/10 z-50">
                  {item.label}
                  <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-950" />
                </span>
              </a>
            );
          })}
        </div>
      </aside>

      {/* 2. Mobile Floating Action Button (FAB) (Visible only on mobile < md) */}
      <div className="md:hidden fixed right-4 bottom-5 z-40 flex flex-col items-end select-none">
        {/* Expanded Social Icons Sheet */}
        {mobileOpen && (
          <div className="mb-2.5 flex flex-col items-center gap-2 p-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            {SOCIAL_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-center size-9 rounded-full text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/80 shadow-2xs active:scale-95 transition-all ${item.hoverClass}`}
                >
                  <Icon className="size-4" />
                </a>
              );
            })}
          </div>
        )}

        {/* Floating Trigger Button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close social links" : "Open social links"}
          className={`size-11 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-200 active:scale-90 ${
            mobileOpen
              ? "bg-slate-900 dark:bg-slate-800"
              : "bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-600/30"
          }`}
        >
          {mobileOpen ? <X size={20} /> : <Share2 size={19} />}
        </button>
      </div>
    </>
  );
}

export default FloatingSocials;
