import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Star, Eye, Calendar, Award, Store, Search, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturedProduct {
  id: string;
  name: string;
  vendorName: string;
  slotType: "Hero Banner" | "Trending Now" | "Deal of the Day";
  price: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Scheduled";
}

export function MarketplaceFeatured() {
  const [searchTerm, setSearchTerm] = useState("");

  const [featuredItems, setFeaturedItems] = useState<FeaturedProduct[]>([
    {
      id: "FT-101",
      name: "Ultra HD Smart LED Monitor 32-Inch",
      vendorName: "Apex Tech Solutions",
      slotType: "Hero Banner",
      price: 189.99,
      impressions: 48500,
      clicks: 3420,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      status: "Active",
    },
    {
      id: "FT-102",
      name: "Ergonomic Executive Office Chair",
      vendorName: "Urban Retail Group",
      slotType: "Trending Now",
      price: 245.00,
      impressions: 29100,
      clicks: 1890,
      startDate: "2026-08-10",
      endDate: "2026-08-25",
      status: "Active",
    },
    {
      id: "FT-103",
      name: "Precision Industrial Tool Set 120-Piece",
      vendorName: "Nexus Supply Chain",
      slotType: "Deal of the Day",
      price: 320.00,
      impressions: 14200,
      clicks: 980,
      startDate: "2026-08-15",
      endDate: "2026-08-16",
      status: "Active",
    },
  ]);

  const filtered = featuredItems.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Featured & Sponsored Marketplace Listings</h1>
          <p className="text-sm text-muted-foreground">Manage homepage slotting, sponsored vendor products, hero banners, and impression performance.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search featured listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 space-y-4 hover:border-primary/20 transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                  <Sparkles className="size-3 fill-amber-400" /> {item.slotType}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {item.status}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-base leading-snug">{item.name}</h3>
              <p className="text-xs text-muted-foreground">Vendor: <strong className="text-foreground">{item.vendorName}</strong></p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-background/50 p-3 rounded-lg border border-border/40 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Impressions</span>
                <span className="font-bold text-foreground font-mono">{item.impressions.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Clicks</span>
                <span className="font-bold text-primary font-mono">{item.clicks.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t border-border/30">
              <span>Duration: <strong className="text-foreground">{item.startDate} to {item.endDate}</strong></span>
              <span className="font-bold text-emerald-500 font-mono">${item.price.toFixed(2)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
