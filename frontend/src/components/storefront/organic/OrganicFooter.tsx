import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Truck, ShieldCheck, Award, PiggyBank, Tag,
  Facebook, Twitter, Instagram, Youtube, Send,
  MapPin, Mail, Phone, ArrowRight, CheckCircle2
} from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { toast } from "sonner";

export function OrganicFooter() {
  const { theme, branding, getStoreUrl } = useStoreTheme();
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const effectiveStoreName = branding.storeName?.trim() || theme.name || "BusinessOS Store";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      return toast.error("Please enter a valid email address.");
    }
    setIsSubscribed(true);
    toast.success(`Thank you for subscribing to ${effectiveStoreName} deals & updates!`);
    setEmail("");
  };

  const trustHighlights = [
    {
      icon: Truck,
      title: "Fast Doorstep Delivery",
      description: "Priority express logistics directly to your door.",
    },
    {
      icon: ShieldCheck,
      title: "100% Safe Payments",
      description: "SSL encrypted checkouts & instant tax receipts.",
    },
    {
      icon: Award,
      title: "Quality Guarantee",
      description: "Verified brands & certified manufacturer warranty.",
    },
    {
      icon: PiggyBank,
      title: "Best Price Promise",
      description: "Direct supplier deals & extra member savings.",
    },
    {
      icon: Tag,
      title: "Flash Daily Offers",
      description: "Exclusive limited-time promo vouchers & discounts.",
    },
  ];

  return (
    <footer className="w-full bg-white border-t border-gray-100 mt-16 font-sans">
      {/* ── 5 Feature Trust Highlights ── */}
      <div className="border-b border-gray-100 bg-[#F9FAF8] py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {trustHighlights.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3.5 group">
                <div
                  className="size-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-2xs group-hover:text-white transition-colors duration-300"
                  style={{ color: theme.primaryColor }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.primaryColor;
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.color = theme.primaryColor;
                  }}
                >
                  <item.icon className="size-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Multi-Column Footer ── */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Col 1: Logo & Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to={getStoreUrl("") as any} className="inline-flex items-center gap-2 group">
              <div
                className="size-9 rounded-xl flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform overflow-hidden relative"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <span className="text-lg select-none">🛍️</span>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-base text-gray-900 tracking-tight font-sans leading-tight flex items-center">
                  {effectiveStoreName}
                </span>
                <span className="text-[8px] text-gray-400 font-bold tracking-[0.2em] uppercase truncate max-w-[200px]">
                  {branding.tagline?.trim() || theme.tagline || "WORK SMARTER • LIVE BETTER"}
                </span>
              </div>
            </Link>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
              Discover verified products with live inventory availability, secure checkouts, and priority fulfillment powered by {effectiveStoreName}.
            </p>

            <div className="pt-2">
              <span className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
                Connect With Us
              </span>
              <div className="flex items-center gap-2">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="size-8 rounded-full bg-gray-100 text-gray-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.primaryColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                    }}
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-4">
              Catalog & Hardware
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <Link to={getStoreUrl("/shop") as any} className="hover:opacity-80 transition-colors">
                  All Catalog Items
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/shop") as any} search={{ filter: "sale" } as any} className="hover:opacity-80 transition-colors">
                  Wholesale & Promo Bundles
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/shop") as any} search={{ filter: "coupons" } as any} className="hover:opacity-80 transition-colors">
                  Enterprise Promo Codes
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/orders") as any} className="hover:opacity-80 transition-colors">
                  Dispatch & Order Tracking
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/account") as any} className="hover:opacity-80 transition-colors">
                  Buyer Account Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Customer Service */}
          <div>
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-4">
              Enterprise Support
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <Link to={getStoreUrl("/about") as any} className="hover:opacity-80 transition-colors">
                  About Store
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/contact") as any} className="hover:opacity-80 transition-colors">
                  Help Desk & SLA Support
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/styles") as any} className="hover:opacity-80 transition-colors">
                  Product Specifications
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/blog") as any} className="hover:opacity-80 transition-colors">
                  Tech & Logistics Updates
                </Link>
              </li>
              <li>
                <Link to={getStoreUrl("/thank-you") as any} className="hover:opacity-80 transition-colors">
                  Order Invoices & Receipts
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter Subscription */}
          <div>
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-4">
              Procurement Updates
            </h4>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Subscribe for new equipment arrivals, bulk volume rebate notices, and supply chain updates.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter business email..."
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 text-white rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-xs hover:brightness-95"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <Send className="size-3.5" />
                </button>
              </div>

              {isSubscribed && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: theme.primaryColor }}>
                  <CheckCircle2 className="size-3.5" /> Subscribed successfully!
                </div>
              )}
            </form>
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="border-t border-slate-200 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 {effectiveStoreName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to={getStoreUrl("/about") as any} className="hover:text-slate-700">Privacy Policy</Link>
            <span>•</span>
            <Link to={getStoreUrl("/about") as any} className="hover:text-slate-700">Terms of Procurement</Link>
            <span>•</span>
            <Link to={getStoreUrl("/contact") as any} className="hover:text-slate-700">GST Compliance</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
