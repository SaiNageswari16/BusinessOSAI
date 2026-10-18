import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { Zap, Clock, ShieldCheck, PhoneCall, Mail, Smartphone, ArrowRight, Heart } from "lucide-react";

export function QuickMartFooter() {
  const { theme, branding } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#7C3AED";
  const accentColor = theme.accentColor || "#F59E0B";

  return (
    <footer className="w-full bg-[#1E0E3E] text-purple-100 font-sans border-t border-purple-900/60">
      {/* ── Top Guarantee Strip ── */}
      <div className="border-b border-purple-900/40 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-400 text-purple-950 flex items-center justify-center shrink-0 font-bold shadow-md">
              <Zap className="size-5 fill-current" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">10-Min Fast Dispatch</div>
              <div className="text-[11px] text-purple-300">Hyperlocal darkstore network</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 font-bold shadow-md">
              <Clock className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Late Night Delivery</div>
              <div className="text-[11px] text-purple-300">Open until 3:00 AM daily</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold shadow-md">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Instant In-App Refunds</div>
              <div className="text-[11px] text-purple-300">No questions asked return</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-800 text-amber-300 flex items-center justify-center shrink-0 font-bold shadow-md">
              <Smartphone className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Live Courier Tracking</div>
              <div className="text-[11px] text-purple-300">GPS live map on your orders</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Links & Brand Section ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand info (2 cols) */}
          <div className="lg:col-span-2 space-y-3 text-left">
            <div className="flex items-center gap-2">
              <div
                className="size-8 rounded-lg flex items-center justify-center text-white font-black shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                <Zap className="size-4 fill-amber-300 text-amber-300" />
              </div>
              <span className="text-lg font-black tracking-tight text-white">
                {theme.name || "ExpressMart"}
              </span>
            </div>
            <p className="text-xs text-purple-200/80 leading-relaxed max-w-sm">
              {theme.tagline || "10-Minute Hyperlocal Quick Commerce"} — delivering fresh groceries, chilled drinks, urgent personal care, and midnight snacks directly to your doorstep.
            </p>

            <div className="space-y-1.5 pt-2 text-xs text-purple-300">
              <div className="flex items-center gap-2">
                <PhoneCall className="size-3.5 text-amber-400" />
                <span>Helpline: {branding.supportPhone || "+91 98450 12345"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-amber-400" />
                <span>Support: {branding.supportEmail || "support@businessos.store"}</span>
              </div>
            </div>
          </div>

          {/* Quick Categories */}
          <div className="text-left space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Popular Aisles
            </h4>
            <ul className="space-y-1.5 text-xs text-purple-200">
              <li><Link to="/store/shop" search={{ category: "Snacks" } as any} className="hover:text-white transition-colors">Instant Munchies</Link></li>
              <li><Link to="/store/shop" search={{ category: "Dairy" } as any} className="hover:text-white transition-colors">Fresh Milk & Curd</Link></li>
              <li><Link to="/store/shop" search={{ category: "Beverages" } as any} className="hover:text-white transition-colors">Chilled Cold Drinks</Link></li>
              <li><Link to="/store/shop" search={{ category: "Bakery" } as any} className="hover:text-white transition-colors">Artisanal Breads</Link></li>
              <li><Link to="/store/shop" search={{ category: "Produce" } as any} className="hover:text-white transition-colors">Farm Fresh Greens</Link></li>
            </ul>
          </div>

          {/* Customer Support */}
          <div className="text-left space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Orders & Support
            </h4>
            <ul className="space-y-1.5 text-xs text-purple-200">
              <li><Link to="/store/orders" className="hover:text-white transition-colors">Track Live Orders</Link></li>
              <li><Link to="/store/cart" className="hover:text-white transition-colors">Instant Checkout</Link></li>
              <li><Link to="/store/account" className="hover:text-white transition-colors">Saved Addresses</Link></li>
              <li><Link to="/store/wallet" className="hover:text-white transition-colors">Express Cash Wallet</Link></li>
              <li><Link to="/store/contact" className="hover:text-white transition-colors">Customer Care</Link></li>
            </ul>
          </div>

          {/* 10-Minute Promise Badge */}
          <div className="text-left space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Hyperlocal Promise
            </h4>
            <div className="p-3 rounded-xl bg-purple-900/60 border border-purple-800 text-xs text-purple-200 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Zap className="size-3.5 text-amber-400 fill-current" />
                <span>Lightning Dispatch</span>
              </div>
              <p className="text-[11px] text-purple-300">
                Orders are packed within 90 seconds of placement and handed over to express delivery riders.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom Copyright Bar ── */}
      <div className="border-t border-purple-900/50 py-4 px-4 sm:px-6 text-center text-xs text-purple-300/80">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            &copy; {new Date().getFullYear()} {theme.name || "ExpressMart"} &bull; Powered by BusinessOS Multi-SaaS
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            Engineered for lightning-speed retail with <Heart className="size-3 text-rose-500 fill-current" />
          </span>
        </div>
      </div>
    </footer>
  );
}
