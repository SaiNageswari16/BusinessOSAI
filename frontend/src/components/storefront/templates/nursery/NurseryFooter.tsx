import React from "react";
import { Link } from "@tanstack/react-router";
import { Sprout, PhoneCall, Mail, MapPin, ShieldCheck, Heart, Leaf, Sun, Droplets } from "lucide-react";

export function NurseryFooter() {
  return (
    <footer className="w-full bg-[#1B4D3E] text-[#E8F3EE] pt-14 pb-8 border-t border-[#153D31] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Top Guarantee Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-12 border-b border-[#2D735C]/40">
          <div className="flex items-start gap-3.5">
            <div className="size-11 rounded-2xl bg-[#2D735C]/30 text-[#86EFAC] flex items-center justify-center shrink-0">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-serif">100% Organically Grown</h4>
              <p className="text-xs text-[#A7F3D0] mt-0.5 leading-relaxed">
                Nurtured with chemical-free compost and bio-fertilizers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="size-11 rounded-2xl bg-[#2D735C]/30 text-[#86EFAC] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-serif">7-Day Transit Health Cover</h4>
              <p className="text-xs text-[#A7F3D0] mt-0.5 leading-relaxed">
                Damaged in courier? Free instant replacement, no questions asked.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="size-11 rounded-2xl bg-[#2D735C]/30 text-[#86EFAC] flex items-center justify-center shrink-0">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-serif">Sun & Water Care Guide</h4>
              <p className="text-xs text-[#A7F3D0] mt-0.5 leading-relaxed">
                Detailed maintenance cards customized for Indian climates.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="size-11 rounded-2xl bg-[#2D735C]/30 text-[#86EFAC] flex items-center justify-center shrink-0">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-serif">Free Plant Doctor Helpline</h4>
              <p className="text-xs text-[#A7F3D0] mt-0.5 leading-relaxed">
                Send photos on WhatsApp for free pest & fertilizer diagnosis.
              </p>
            </div>
          </div>
        </div>

        {/* ── Main Footer Links ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 py-12 border-b border-[#2D735C]/40 text-xs">
          {/* Brand info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[#86EFAC] to-[#22C55E] text-[#1B4D3E] flex items-center justify-center shadow-md">
                <Sprout className="w-5 h-5 font-bold" />
              </div>
              <span className="text-xl font-bold font-serif text-white tracking-tight">GreenFlora Nursery</span>
            </div>
            <p className="text-xs text-[#A7F3D0] leading-relaxed max-w-sm">
              We connect urban plant lovers with certified organic botanicals. Sourced directly from local nursery farmers and dispatched in breathable eco-packaging.
            </p>
            <div className="pt-2 text-[11px] text-[#86EFAC]">
              <span>Helpline: <strong>+91 98450 12345</strong> (9 AM – 7 PM)</span>
            </div>
          </div>

          {/* Plants Category */}
          <div className="space-y-3">
            <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">Plant Categories</h5>
            <ul className="space-y-2 text-[#A7F3D0]">
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Air Purifying Plants</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Succulents & Cacti</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Bonsai & Flowering</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Low Light Indoor Plants</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Pet-Friendly Greenery</Link></li>
            </ul>
          </div>

          {/* Garden Supplies */}
          <div className="space-y-3">
            <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">Garden Supplies</h5>
            <ul className="space-y-2 text-[#A7F3D0]">
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Artisanal Ceramic Pots</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Bio Organic Fertilizers</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Premium Potting Soil</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Pruners & Hand Tools</Link></li>
              <li><Link to="/store/shop" className="hover:text-white transition-colors">Hanging Planters</Link></li>
            </ul>
          </div>

          {/* Quick Support */}
          <div className="space-y-3">
            <h5 className="font-bold text-white uppercase tracking-wider text-[11px]">Care & Orders</h5>
            <ul className="space-y-2 text-[#A7F3D0]">
              <li><Link to="/store/orders" className="hover:text-white transition-colors">Track Plant Order</Link></li>
              <li><Link to="/store" className="hover:text-white transition-colors">7-Day Guarantee Claim</Link></li>
              <li><Link to="/store" className="hover:text-white transition-colors">Plant Care Guides</Link></li>
              <li><Link to="/store" className="hover:text-white transition-colors">Nursery Franchise</Link></li>
            </ul>
          </div>
        </div>

        {/* ── Bottom Copyright ── */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#A7F3D0] gap-4">
          <div>
            &copy; {new Date().getFullYear()} GreenFlora Nursery & Living Decor &bull; Powered by BusinessOS Multi-SaaS
          </div>
          <div className="flex items-center gap-1.5 text-white/80">
            <span>Nurtured with</span>
            <Heart className="w-3.5 h-3.5 fill-[#C25E3E] text-[#C25E3E]" />
            <span>for Urban Gardeners</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
