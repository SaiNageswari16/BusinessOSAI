import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { Pill, ShieldCheck, Truck, PhoneCall, Award, FileText, CheckCircle2 } from "lucide-react";

export function PharmaFooter() {
  const { theme, branding } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#0284C7";

  return (
    <footer className="w-full bg-[#082F49] text-sky-100 font-sans border-t border-sky-800">
      {/* ── Healthcare Trust Badges ── */}
      <div className="border-b border-sky-800/80 py-7 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">100% Genuine Medicines</div>
              <div className="text-xs text-sky-300">Sourced directly from certified pharma labs</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Award className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Licensed Pharmacist Audit</div>
              <div className="text-xs text-sky-300">Every prescription verified before dispatch</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Truck className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Cold Chain Safe Dispatch</div>
              <div className="text-xs text-sky-300">Insulated temperature monitoring</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <PhoneCall className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Pharmacist Consultation</div>
              <div className="text-xs text-sky-300">Free dosage & salt composition advice</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Links & Compliance ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                <Pill className="size-4" />
              </div>
              <span className="text-lg font-black text-white">{theme.name || "MedPlus"}</span>
            </div>
            <p className="text-xs text-sky-200/80 leading-relaxed">
              {theme.tagline || "Healthcare, Pharmacy & Wellness"} — safe dispensing and genuine healthcare essentials.
            </p>
            <div className="text-xs text-sky-300 pt-2 space-y-1">
              <div>Helpline: {branding.supportPhone || "+91 98450 12345"}</div>
              <div>Consult: {branding.supportEmail || "pharmacist@medplus.store"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Health Categories</h4>
            <ul className="space-y-1 text-xs text-sky-200">
              <li><Link to="/store/shop" search={{ category: "Medicines" } as any} className="hover:text-white">Prescription Medicines</Link></li>
              <li><Link to="/store/shop" search={{ category: "Supplements" } as any} className="hover:text-white">Vitamins & Nutrition</Link></li>
              <li><Link to="/store/shop" search={{ category: "Ayurveda" } as any} className="hover:text-white">Ayurvedic & Herbal</Link></li>
              <li><Link to="/store/shop" search={{ category: "Devices" } as any} className="hover:text-white">Blood Pressure & Glucose</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Prescription Orders</h4>
            <ul className="space-y-1 text-xs text-sky-200">
              <li><Link to="/store/shop" className="hover:text-white">Upload Rx Prescription</Link></li>
              <li><Link to="/store/orders" className="hover:text-white">Refill Previous Orders</Link></li>
              <li><Link to="/store/about" className="hover:text-white">Pharmacy License Details</Link></li>
              <li><Link to="/store/contact" className="hover:text-white">Pharmacist Chat</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Statutory Disclaimer</h4>
            <p className="text-[11px] text-sky-300 leading-relaxed">
              Prescription medicines require a valid doctor's prescription. Self-medication is discouraged.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-sky-800/80 py-4 px-4 text-center text-xs text-sky-400">
        &copy; {new Date().getFullYear()} {theme.name || "MedPlus"} &bull; Licensed Pharmacy &bull; Powered by BusinessOS Multi-SaaS
      </div>
    </footer>
  );
}
