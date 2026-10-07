"use client";

import React, { useState } from "react";
import { Facebook, Instagram, Linkedin, Send, ChevronRight, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { products } from "@/data/products";

export function Footer({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
    }
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <footer className={"w-full bg-[#F9FBFA] px-6 sm:px-12 lg:px-[80px] pt-24 sm:pt-32 pb-10 font-sans overflow-hidden border-t border-[#E4E7EB] " + (className || "")}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16 mb-20">
            {/* 1. Brand Section */}
            <div className="flex flex-col gap-6 col-span-1">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="size-10 rounded-xl bg-purple-50 p-1.5 border border-purple-200/80 shadow-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                  <img
                    src="/logo.png"
                    alt="IOTRONICS Logo"
                    className="size-full object-contain"
                  />
                </div>
                <div>
                  <span className="text-[22px] font-extrabold text-[#010101] tracking-tight group-hover:text-purple-700 transition-colors">
                    IOTRONICS
                  </span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-600 font-mono">
                    Enterprise AI Systems
                  </span>
                </div>
              </Link>

              <p className="text-[15px] leading-[1.6] text-[#6A7281] max-w-[290px]">
                Intelligent Solutions for a Smarter Future. Unifying ERP, POS, Fitness Operations, Luxury Salons, and Automated Business Systems.
              </p>

              {/* Social Buttons */}
              <div className="flex gap-3 mt-1">
                {[
                  { icon: Linkedin, label: "LinkedIn", href: "#contact" },
                  { icon: Facebook, label: "Facebook", href: "#contact" },
                  { icon: Instagram, label: "Instagram", href: "#contact" },
                  { icon: Send, label: "Telegram / Contact", href: "#contact" },
                ].map((item, i) => (
                  <a
                    key={i}
                    href={item.href}
                    aria-label={item.label}
                    className="text-[#4B5563] transition-all w-10 h-10 flex items-center justify-center rounded-full border border-[#E4E7EB] bg-white hover:border-purple-300 hover:text-purple-700 hover:shadow-md hover:-translate-y-1"
                  >
                    <item.icon size={18} strokeWidth={2} />
                  </a>
                ))}
              </div>
            </div>

            {/* 2. Flagship Applications Column */}
            <div className="flex flex-col">
              <h3 className="text-[17px] font-[700] text-[#010101] mb-[26px]">Our Applications</h3>
              <div className="flex flex-col gap-3">
                {products.map((p) => (
                  <Link
                    key={p.id}
                    to="/products/$productId"
                    params={{ productId: p.id }}
                    className="text-[15px] text-[#6A7281] hover:text-purple-700 hover:translate-x-1 no-underline cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <span className="group-hover:font-semibold">{p.name}</span>
                    <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60 font-mono font-bold">
                      {p.badge || "Live"}
                    </span>
                  </Link>
                ))}
                <a
                  href="/#applications"
                  className="text-[14px] text-purple-700 font-bold hover:underline pt-1 flex items-center gap-1"
                >
                  View All Solutions <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>

            {/* 3. Quick Links & Resources Column */}
            <div className="flex flex-col">
              <h3 className="text-[17px] font-[700] text-[#010101] mb-[26px]">Quick Links</h3>
              <div className="flex flex-col gap-3">
                {[
                  { name: "Home", href: "/#top" },
                  { name: "Applications Catalog", href: "/#applications" },
                  { name: "Platform Intelligence", href: "/#features" },
                  { name: "Bespoke Customization", href: "/#customization" },
                  { name: "About Us", href: "/#about" },
                  { name: "Book Enterprise Demo", href: "/#contact" },
                ].map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-[15px] text-[#6A7281] hover:text-purple-700 hover:translate-x-1 no-underline cursor-pointer transition-all"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>

            {/* 4. Newsletter Section — "Stay Ahead" */}
            <div className="flex flex-col col-span-1">
              <h3 className="text-[17px] font-[700] text-[#010101] mb-[26px]">Stay Ahead</h3>
              <p className="text-[14px] text-[#6A7281] mb-6 leading-[1.6]">
                Get periodic updates on new enterprise releases, POS hardware drivers, and AI automation workflows directly in your inbox.
              </p>

              {subscribed ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-600" />
                  <span>Subscribed! You'll receive our monthly tech updates.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="relative flex items-center w-full">
                  <div className="flex-grow relative flex items-center p-1 bg-white border border-[#E4E7EB] rounded-full focus-within:ring-4 focus-within:ring-purple-600/10 focus-within:border-purple-400 transition-all shadow-2xs">
                    <input
                      type="email"
                      required
                      placeholder="Enter work email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-grow bg-transparent py-2.5 px-5 text-[14px] text-[#364050] placeholder:text-[#9CA3AF] outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-700 hover:from-purple-800 hover:to-indigo-700 text-[#FEFEFE] text-[14px] font-[700] py-2.5 px-6 rounded-full cursor-pointer transition-all border-none flex items-center gap-1.5 shadow-[0_4px_14px_0_rgba(124,58,237,0.3)] whitespace-nowrap ml-1 hover:scale-105 hover:brightness-105"
                    >
                      <span>Join</span>
                      <ChevronRight size={16} strokeWidth={3} />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Bottom Bar Section */}
          <div className="pt-8 border-t border-[#E4E7EB] flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#9CA3AF]">
            <div className="flex flex-wrap items-center gap-6">
              <span className="text-[#6A7281] font-semibold">
                © {new Date().getFullYear()} IOTRONICS Technologies Inc. All rights reserved.
              </span>
              <div className="flex items-center gap-5">
                <a href="#contact" className="transition-colors hover:text-purple-700 hover:underline">
                  Privacy Policy
                </a>
                <a href="#contact" className="transition-colors hover:text-purple-700 hover:underline">
                  Terms of Service
                </a>
                <a href="#contact" className="transition-colors hover:text-purple-700 hover:underline">
                  SOC 2 Security
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-[#6A7281] group cursor-pointer hover:text-purple-700 transition-colors">
              <span className="font-semibold underline decoration-transparent group-hover:decoration-purple-600 underline-offset-4 transition-all">
                English (US)
              </span>
              <ChevronRight size={14} className="rotate-90 text-[#9CA3AF] group-hover:text-purple-600" />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
