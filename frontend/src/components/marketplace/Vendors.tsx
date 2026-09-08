import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Store, Search, Filter, MoreHorizontal, Star, Package, DollarSign,
  MapPin, CheckCircle2, XCircle, Clock, Plus, FolderTree, FileCheck,
  CreditCard, ShieldCheck, Activity, Target, Wallet
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";
import { AddVendorModal } from "@/components/marketplace/MarketplaceModals";

export function Vendors() {
  const navigate = useNavigate();
  const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);

  const { data: apiVendors, isLoading } = useQuery({
    queryKey: ["marketplace-vendors"],
    queryFn: () => marketplaceApi.getVendors(),
    staleTime: 30000,
  });

  const vendorsList = apiVendors || [];

  const filtered = vendorsList.filter((v: any) => 
    v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Vendors & Merchants
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
              {vendorsList.length} Active
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">Manage marketplace vendors, commission rates, and partner store profiles.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vendors, trade licenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <button className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer">
            <Filter className="size-4" /> Filter
          </button>
          <button
            onClick={() => setIsAddVendorOpen(true)}
            className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" /> Onboard Vendor
          </button>
        </div>
      </div>

      <AddVendorModal isOpen={isAddVendorOpen} onClose={() => setIsAddVendorOpen(false)} />

      {/* ── Vendors Table ── */}
      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left whitespace-nowrap">Vendor Name</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Vendor ID</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Category</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Location</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Commission</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Rating</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Orders</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Gross Revenue</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">KYC / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {filtered.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 border border-purple-100">
                        {vendor.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-sm">{vendor.name}</div>
                        <div className="text-[11px] text-muted-foreground">{vendor.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">{vendor.id}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      <Store className="size-3 text-slate-500" /> {vendor.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5 text-slate-400" /> {vendor.location}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {vendor.commission_rate || 10}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                      <Star className="size-3.5 text-amber-500 fill-amber-500" />
                      {vendor.rating > 0 ? vendor.rating : "New"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {Number(vendor.totalOrders || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                    {currency.symbol}{(Number(vendor.revenue || 0) / 1000).toFixed(0)}K
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      vendor.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                      vendor.status === "Pending" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    )}>
                      {vendor.kyc_status || vendor.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
