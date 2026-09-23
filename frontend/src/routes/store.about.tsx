import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, Award, Cpu, ShieldCheck, Truck, Users, Layers, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/store/about")({
  component: AboutUsPage,
});

function AboutUsPage() {
  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-slate-50 py-8 mb-10 border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 font-organic-heading mb-2">
            About BusinessOS Store
          </h1>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#2563EB] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#2563EB] font-bold">About Platform</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 space-y-16 max-w-5xl">
        {/* Story Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#2563EB] bg-blue-50 px-3 py-1 rounded-full">
              Our Mission
            </span>
            <h2 className="text-3xl font-black text-slate-900 font-organic-heading leading-tight">
              Empowering merchants and enterprises with reliable commercial hardware & procurement.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              BusinessOS Marketplace is built to solve hardware fragmentation and procurement delays for modern retail chains,
              supermarkets, and commercial enterprises. We connect verified OEMs directly with businesses, offering pre-configured,
              GST-compliant POS systems, billing consumables, and barcode peripherals.
            </p>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every smart terminal, thermal printer, and RFID component is bench-tested for commercial durability and backed
              by a 1-year OEM warranty with priority enterprise support.
            </p>
          </div>

          <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-200 aspect-[4/3]">
            <img
              src="https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&q=80"
              alt="Enterprise POS & Commercial Hardware"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* 4 Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#2563EB] flex items-center justify-center mx-auto shadow-2xs border border-slate-200">
              <Award className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">OEM Verified</h3>
            <p className="text-xs text-slate-500">100% genuine hardware with certified warranty backing.</p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#2563EB] flex items-center justify-center mx-auto shadow-2xs border border-slate-200">
              <Truck className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Express Logistics</h3>
            <p className="text-xs text-slate-500">Pan-India express courier dispatch with live tracking.</p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#2563EB] flex items-center justify-center mx-auto shadow-2xs border border-slate-200">
              <ShieldCheck className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">GST Compliant</h3>
            <p className="text-xs text-slate-500">Automated B2B invoicing with full Input Tax Credit eligibility.</p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
            <div className="size-12 rounded-full bg-white text-[#2563EB] flex items-center justify-center mx-auto shadow-2xs border border-slate-200">
              <Users className="size-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">B2B Account Support</h3>
            <p className="text-xs text-slate-500">Dedicated relationship manager for enterprise orders.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-3xl bg-[#2563EB] text-white p-8 md:p-12 text-center space-y-4 shadow-lg">
          <h3 className="text-2xl sm:text-3xl font-black font-organic-heading">
            Equip your enterprise with smart commercial technology
          </h3>
          <p className="text-xs sm:text-sm text-blue-100 max-w-lg mx-auto">
            Get instant quotes for bulk orders and setup your business procurement portal today.
          </p>
          <Link
            to="/store/shop"
            className="inline-flex items-center gap-2 bg-white text-[#2563EB] hover:bg-slate-100 px-8 py-3.5 rounded-full text-xs font-bold transition-all shadow-md"
          >
            Explore Equipment Catalog <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
