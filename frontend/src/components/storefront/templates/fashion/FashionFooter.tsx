import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { Sparkles, ShieldCheck, RefreshCw, Truck, Heart } from "lucide-react";

export function FashionFooter() {
  const { theme, branding } = useStoreTheme();

  return (
    <footer className="w-full bg-[#18181B] text-zinc-300 font-sans border-t border-zinc-800">
      {/* ── Editorial Promises ── */}
      <div className="border-b border-zinc-800/80 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="flex items-start gap-3">
            <Truck className="size-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">Express Dispatch</div>
              <div className="text-[11px] text-zinc-400">Complimentary on orders above ₹1,999</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <RefreshCw className="size-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">14-Day Exchanges</div>
              <div className="text-[11px] text-zinc-400">Doorstep trial & instant exchange</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">Authentic Designers</div>
              <div className="text-[11px] text-zinc-400">Handcrafted quality materials</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Sparkles className="size-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">Curated Collections</div>
              <div className="text-[11px] text-zinc-400">Updated weekly with new runway looks</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Links ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-serif tracking-tight text-white">{theme.name || "Vogue Studio"}</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {theme.tagline || "Fashion, Designer Apparel & Luxury Lifestyle"}
            </p>
            <div className="text-xs text-zinc-400 pt-2 space-y-1">
              <div>Concierge: {branding.supportPhone || "+91 98450 12345"}</div>
              <div>Stylist: {branding.supportEmail || "stylist@voguestudio.store"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Collections</h4>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li><Link to="/store/shop" className="hover:text-white">Runway New Arrivals</Link></li>
              <li><Link to="/store/shop" search={{ category: "Women" } as any} className="hover:text-white">Women's Couture</Link></li>
              <li><Link to="/store/shop" search={{ category: "Men" } as any} className="hover:text-white">Men's Tailoring</Link></li>
              <li><Link to="/store/shop" search={{ category: "Accessories" } as any} className="hover:text-white">Jewelry & Footwear</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Client Care</h4>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li><Link to="/store/account" className="hover:text-white">Boutique Account</Link></li>
              <li><Link to="/store/orders" className="hover:text-white">Order Tracking</Link></li>
              <li><Link to="/store/about" className="hover:text-white">Size Fit Guide</Link></li>
              <li><Link to="/store/contact" className="hover:text-white">Personal Stylist Appointment</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Boutique Guarantee</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every garment is hand-inspected, steam-pressed, and packaged in eco-luxury garment carriers before dispatch.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800/80 py-4 px-4 text-center text-xs text-zinc-500">
        &copy; {new Date().getFullYear()} {theme.name || "Vogue Studio"} &bull; Luxury Boutique &bull; Powered by BusinessOS Multi-SaaS
      </div>
    </footer>
  );
}
