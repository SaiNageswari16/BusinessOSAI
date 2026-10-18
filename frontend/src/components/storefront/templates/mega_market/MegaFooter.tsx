import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { Laptop, ShieldCheck, Truck, RotateCcw, Headphones, Heart } from "lucide-react";

export function MegaFooter() {
  const { theme, branding } = useStoreTheme();
  const accentColor = theme.accentColor || "#2563EB";

  return (
    <footer className="w-full bg-[#0B0F19] text-slate-300 font-sans border-t border-slate-800">
      {/* ── Top Tech Value Prop ── */}
      <div className="border-b border-slate-800/80 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="flex items-start gap-3">
            <Truck className="size-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-white">Insured Tech Transit</div>
              <div className="text-xs text-slate-400">Tamper-proof packaging</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="size-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-white">100% Genuine Brands</div>
              <div className="text-xs text-slate-400">Direct manufacturer warranty</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <RotateCcw className="size-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-white">7-Day Tech Replacement</div>
              <div className="text-xs text-slate-400">Defect-free guarantee</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Headphones className="size-6 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-white">Expert Spec Support</div>
              <div className="text-xs text-slate-400">Assistance from certified geeks</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Links & Contact ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: accentColor }}>
                <Laptop className="size-4" />
              </div>
              <span className="text-lg font-black text-white">{theme.name || "MegaStore"}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {theme.tagline || "Electronics, Gadgets, Multi-Category & Hardware"}
            </p>
            <div className="text-xs text-slate-400 pt-2 space-y-1">
              <div>Phone: {branding.supportPhone || "+91 98450 12345"}</div>
              <div>Email: {branding.supportEmail || "tech@megastore.in"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Top Departments</h4>
            <ul className="space-y-1 text-xs text-slate-400">
              <li><Link to="/store/shop" search={{ category: "Laptops" } as any} className="hover:text-white">Laptops & Desktops</Link></li>
              <li><Link to="/store/shop" search={{ category: "Mobiles" } as any} className="hover:text-white">Smartphones & Tablets</Link></li>
              <li><Link to="/store/shop" search={{ category: "Gaming" } as any} className="hover:text-white">Gaming Consoles & GPUs</Link></li>
              <li><Link to="/store/shop" search={{ category: "Audio" } as any} className="hover:text-white">Headphones & Soundbars</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Customer Services</h4>
            <ul className="space-y-1 text-xs text-slate-400">
              <li><Link to="/store/orders" className="hover:text-white">Track Your Shipment</Link></li>
              <li><Link to="/store/shop" className="hover:text-white">Warranty Registration</Link></li>
              <li><Link to="/store/about" className="hover:text-white">Service Centers</Link></li>
              <li><Link to="/store/contact" className="hover:text-white">Corporate Inquiries</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Hardware Guarantee</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              All electronic items shipped via {theme.name || "MegaStore"} include serialized serial numbers and manufacturer warranties verified against counterfeit distribution.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} {theme.name || "MegaStore"} &bull; Powered by BusinessOS Multi-SaaS
      </div>
    </footer>
  );
}
