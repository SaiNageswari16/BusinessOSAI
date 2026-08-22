import React, { useState, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Tag, Zap, Gift, Target, Megaphone, Wallet, Award, Plus, Search,
  CheckCircle2, Sparkles, Percent, DollarSign, Clock, Users, ArrowUpRight, Copy
} from "lucide-react";
import { marketplaceApi } from "@/lib/marketplace-api";
import { cn } from "@/lib/utils";

interface Coupon {
  id: string;
  code: string;
  type: "Percentage" | "Fixed Amount";
  discountValue: number;
  minOrderValue: number;
  usageCount: number;
  maxUsage: number;
  expiryDate: string;
  status: "Active" | "Expired" | "Scheduled";
}

interface Offer {
  id: string;
  title: string;
  type: "Buy 1 Get 1 (BOGO)" | "Category Discount" | "Vendor Co-Funded";
  discountDetail: string;
  applicableCategory: string;
  status: "Active" | "Scheduled";
}

interface Campaign {
  id: string;
  title: string;
  channel: "Email" | "Push Notification" | "Social Media Ad" | "Banner Ad";
  reachCount: number;
  clickThroughRate: number; // percentage
  revenueGenerated: number;
  status: "Live" | "Completed" | "Draft";
}

interface FlashSale {
  id: string;
  title: string;
  discountPercentage: number;
  startTime: string;
  endTime: string;
  itemsCount: number;
  status: "Live" | "Upcoming" | "Ended";
}

interface WalletRule {
  id: string;
  name: string;
  cashbackPercentage: number;
  minOrderValue: number;
  maxCashbackPerOrder: number;
  totalCashbackDisbursed: number;
  status: "Active" | "Inactive";
}

interface LoyaltyTier {
  tierName: "Bronze" | "Silver" | "Gold" | "Platinum";
  minSpend: number;
  pointsMultiplier: string;
  membersCount: number;
  perks: string;
}

interface GiftCardBatch {
  id: string;
  batchName: string;
  codePrefix: string;
  voucherValue: number;
  totalVouchers: number;
  redeemedCount: number;
  expiryDate: string;
}

export function MarketplacePromotions() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  
  let currentTabFromUrl = "coupons";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    currentTabFromUrl = params.get("tab") || "coupons";
  }

  const [activeTab, setActiveTab] = useState<
    "coupons" | "offers" | "campaigns" | "flash_sales" | "wallet" | "loyalty" | "gift_cards"
  >("coupons");

  useEffect(() => {
    if (["coupons", "offers", "campaigns", "flash_sales", "wallet", "loyalty", "gift_cards"].includes(currentTabFromUrl)) {
      setActiveTab(currentTabFromUrl as any);
    }
  }, [currentTabFromUrl]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddCouponModal, setShowAddCouponModal] = useState(false);

  // State Mock Data
  const [coupons, setCoupons] = useState<Coupon[]>([
    { id: "CPN-101", code: "WELCOME20", type: "Percentage", discountValue: 20, minOrderValue: 50, usageCount: 428, maxUsage: 1000, expiryDate: "2026-12-31", status: "Active" },
    { id: "CPN-102", code: "FLASH50", type: "Fixed Amount", discountValue: 50, minOrderValue: 250, usageCount: 195, maxUsage: 300, expiryDate: "2026-08-31", status: "Active" },
    { id: "CPN-103", code: "SUMMER15", type: "Percentage", discountValue: 15, minOrderValue: 100, usageCount: 500, maxUsage: 500, expiryDate: "2026-07-31", status: "Expired" },
  ]);

  useEffect(() => {
    marketplaceApi.getCoupons().then(data => {
      if (data.coupons && data.coupons.length > 0) {
        setCoupons(data.coupons);
      }
    }).catch(() => {});
  }, []);

  const [offers] = useState<Offer[]>([
    { id: "OFF-201", title: "Buy 1 Monitor Get Heavy Duty Mount Free", type: "Buy 1 Get 1 (BOGO)", discountDetail: "Free Mount ($45 Value)", applicableCategory: "Electronics & Computing", status: "Active" },
    { id: "OFF-202", title: "Vendor Co-Funded Office Furniture Sale", type: "Vendor Co-Funded", discountDetail: "Flat 25% Off (50/50 Split)", applicableCategory: "Office Furniture", status: "Active" },
  ]);

  const [campaigns] = useState<Campaign[]>([
    { id: "CMP-301", title: "Q3 B2B Tech Procurement Mega Campaign", channel: "Email", reachCount: 45000, clickThroughRate: 8.4, revenueGenerated: 124500, status: "Live" },
    { id: "CMP-302", title: "Social Media Sponsored Vendor Showcase", channel: "Social Media Ad", reachCount: 120000, clickThroughRate: 4.2, revenueGenerated: 68000, status: "Live" },
  ]);

  const [flashSales] = useState<FlashSale[]>([
    { id: "FS-001", title: "SuperTech Midnight Mega Flash Sale", discountPercentage: 40, startTime: "2026-08-15 00:00", endTime: "2026-08-16 23:59", itemsCount: 48, status: "Live" },
    { id: "FS-002", title: "Weekend Office & Electronics Bonanza", discountPercentage: 35, startTime: "2026-08-20 09:00", endTime: "2026-08-22 23:59", itemsCount: 120, status: "Upcoming" },
  ]);

  const [walletRules] = useState<WalletRule[]>([
    { id: "WAL-401", name: "Standard 5% Store Wallet Cashback", cashbackPercentage: 5, minOrderValue: 100, maxCashbackPerOrder: 25, totalCashbackDisbursed: 14850, status: "Active" },
  ]);

  const [loyaltyTiers] = useState<LoyaltyTier[]>([
    { tierName: "Bronze", minSpend: 0, pointsMultiplier: "1.0x", membersCount: 12400, perks: "Standard Rewards & Free Ground Shipping > $100" },
    { tierName: "Silver", minSpend: 1000, pointsMultiplier: "1.5x", membersCount: 3200, perks: "Priority Support & Early Access to Flash Sales" },
    { tierName: "Gold", minSpend: 5000, pointsMultiplier: "2.0x", membersCount: 850, perks: "Dedicated Account Manager & 2% Extra Wallet Cashback" },
    { tierName: "Platinum", minSpend: 25000, pointsMultiplier: "3.0x", membersCount: 120, perks: "VIP Concierge, Custom Invoicing & Zero Payment Fees" },
  ]);

  const [giftCardBatches] = useState<GiftCardBatch[]>([
    { id: "GC-501", batchName: "Corporate B2B Buyer Welcome Vouchers", codePrefix: "CORP2026", voucherValue: 100, totalVouchers: 500, redeemedCount: 342, expiryDate: "2026-12-31" },
  ]);

  const [newCoupon, setNewCoupon] = useState({
    code: "",
    type: "Percentage" as const,
    discountValue: 10,
    minOrderValue: 50,
    maxUsage: 500,
    expiryDate: "2026-12-31",
  });

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code) return;
    setCoupons([
      {
        id: `CPN-${Date.now()}`,
        code: newCoupon.code.toUpperCase(),
        type: newCoupon.type,
        discountValue: Number(newCoupon.discountValue),
        minOrderValue: Number(newCoupon.minOrderValue),
        usageCount: 0,
        maxUsage: Number(newCoupon.maxUsage),
        expiryDate: newCoupon.expiryDate,
        status: "Active",
      },
      ...coupons,
    ]);
    setShowAddCouponModal(false);
    setNewCoupon({ code: "", type: "Percentage", discountValue: 10, minOrderValue: 50, maxUsage: 500, expiryDate: "2026-12-31" });
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Promotions, Offers & Loyalty Engine</h1>
          <p className="text-sm text-muted-foreground">Manage discount coupons, promotional offers, marketing campaigns, flash sales, cashback wallets, and loyalty programs.</p>
        </div>
        {activeTab === "coupons" && (
          <button 
            onClick={() => setShowAddCouponModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="size-4" /> Create Coupon
          </button>
        )}
      </div>

      {/* 7 Sub-Tab Navigation Bar */}
      <div className="flex border-b border-border/50 gap-4 overflow-x-auto text-xs font-semibold">
        <button 
          onClick={() => setActiveTab("coupons")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "coupons" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Tag className="size-3.5" /> Coupons ({coupons.length})
        </button>
        <button 
          onClick={() => setActiveTab("offers")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "offers" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Target className="size-3.5 text-purple-500" /> Offers & BOGO ({offers.length})
        </button>
        <button 
          onClick={() => setActiveTab("campaigns")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "campaigns" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Megaphone className="size-3.5 text-sky-500" /> Campaigns ({campaigns.length})
        </button>
        <button 
          onClick={() => setActiveTab("flash_sales")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "flash_sales" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Zap className="size-3.5 text-amber-500" /> Flash Sales ({flashSales.length})
        </button>
        <button 
          onClick={() => setActiveTab("wallet")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "wallet" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Wallet className="size-3.5 text-emerald-500" /> Wallet & Cashback
        </button>
        <button 
          onClick={() => setActiveTab("loyalty")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "loyalty" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Award className="size-3.5 text-amber-400" /> Loyalty Program
        </button>
        <button 
          onClick={() => setActiveTab("gift_cards")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "gift_cards" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Gift className="size-3.5 text-pink-500" /> Gift Cards & Vouchers
        </button>
      </div>

      {/* 1. COUPONS VIEW */}
      {activeTab === "coupons" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search coupon codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCoupons.map((coupon, i) => (
              <motion.div
                key={coupon.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden space-y-4 hover:border-primary/20 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{coupon.type}</span>
                    <h3 className="text-xl font-extrabold text-primary font-mono flex items-center gap-2">
                      {coupon.code}
                    </h3>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                    coupon.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-red-500/10 text-red-600 border border-red-500/20"
                  )}>
                    {coupon.status}
                  </span>
                </div>

                <div className="bg-background/50 p-3 rounded-lg border border-border/40 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between text-foreground font-semibold">
                    <span>Discount Value:</span>
                    <span className="text-emerald-500">{coupon.type === "Percentage" ? `${coupon.discountValue}% OFF` : `$${coupon.discountValue} OFF`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Purchase:</span>
                    <span className="font-mono text-foreground">${coupon.minOrderValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Redemptions:</span>
                    <span className="font-mono text-foreground">{coupon.usageCount} / {coupon.maxUsage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expires On:</span>
                    <span className="font-mono text-foreground">{coupon.expiryDate}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 2. OFFERS VIEW */}
      {activeTab === "offers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offers.map((off) => (
            <div key={off.id} className="glass-panel p-6 rounded-xl border border-border/50 space-y-3">
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  {off.type}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {off.status}
                </span>
              </div>
              <h3 className="font-bold text-foreground text-base">{off.title}</h3>
              <div className="bg-background/50 p-3 rounded-lg border border-border/40 text-xs space-y-1">
                <p className="text-emerald-500 font-bold text-sm">{off.discountDetail}</p>
                <p className="text-muted-foreground">Category: <strong className="text-foreground">{off.applicableCategory}</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. CAMPAIGNS VIEW */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          {campaigns.map((cmp) => (
            <div key={cmp.id} className="glass-panel p-5 rounded-xl border border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/10 text-sky-600 border border-sky-500/20">
                    {cmp.channel}
                  </span>
                  <h3 className="font-bold text-foreground text-base">{cmp.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground">Reach: <strong className="text-foreground">{cmp.reachCount.toLocaleString()} buyers</strong></p>
              </div>
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">CTR</span>
                  <p className="font-bold text-foreground font-mono text-sm">{cmp.clickThroughRate}%</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase">Revenue Generated</span>
                  <p className="font-bold text-emerald-500 font-mono text-sm">${cmp.revenueGenerated.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. FLASH SALES VIEW */}
      {activeTab === "flash_sales" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flashSales.map((fs) => (
            <div key={fs.id} className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1 w-fit">
                    <Zap className="size-3 fill-amber-500" /> {fs.status} Flash Sale
                  </span>
                  <h3 className="font-bold text-foreground text-lg">{fs.title}</h3>
                </div>
                <div className="text-2xl font-extrabold text-primary font-mono">
                  {fs.discountPercentage}% OFF
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-background/50 p-3 rounded-lg border border-border/40">
                <div>
                  <p className="text-[10px] uppercase">Start Window</p>
                  <p className="font-semibold text-foreground font-mono">{fs.startTime}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase">End Window</p>
                  <p className="font-semibold text-foreground font-mono">{fs.endTime}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. WALLET & CASHBACK VIEW */}
      {activeTab === "wallet" && (
        <div className="space-y-4">
          {walletRules.map((w) => (
            <div key={w.id} className="glass-panel p-6 rounded-xl border border-border/50 space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-foreground text-base">{w.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {w.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs bg-background/50 p-3 rounded-lg border border-border/40 text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Cashback Rate</span>
                  <p className="font-bold text-emerald-500 text-sm font-mono">{w.cashbackPercentage}%</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Min Order</span>
                  <p className="font-bold text-foreground font-mono">${w.minOrderValue}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Total Cashback Given</span>
                  <p className="font-bold text-primary font-mono">${w.totalCashbackDisbursed.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. LOYALTY PROGRAM VIEW */}
      {activeTab === "loyalty" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loyaltyTiers.map((t) => (
            <div key={t.tierName} className="glass-panel p-5 rounded-xl border border-border/50 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-extrabold text-foreground text-base">{t.tierName} Tier</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20 font-mono">
                    {t.pointsMultiplier}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Min Spend: <strong className="text-foreground">${t.minSpend.toLocaleString()}</strong></p>
              </div>
              <div className="bg-background/50 p-3 rounded-lg border border-border/40 text-xs space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Tier Perks</span>
                <p className="text-foreground">{t.perks}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7. GIFT CARDS VIEW */}
      {activeTab === "gift_cards" && (
        <div className="space-y-4">
          {giftCardBatches.map((gc) => (
            <div key={gc.id} className="glass-panel p-6 rounded-xl border border-border/50 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-foreground text-base">{gc.batchName}</h3>
                  <p className="text-xs text-muted-foreground font-mono">Prefix: {gc.codePrefix} • Value: ${gc.voucherValue}/card</p>
                </div>
                <span className="font-bold text-emerald-500 font-mono text-base">${(gc.totalVouchers * gc.voucherValue).toLocaleString()} Total</span>
              </div>
              <div className="bg-background/50 p-3 rounded-lg border border-border/40 text-xs flex justify-between">
                <span>Redeemed Vouchers: <strong className="text-foreground">{gc.redeemedCount} / {gc.totalVouchers}</strong></span>
                <span>Expires On: <strong className="text-foreground">{gc.expiryDate}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Coupon Modal */}
      {showAddCouponModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-foreground text-lg">Create New Promo Coupon</h3>
            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Coupon Code</label>
                <input type="text" required placeholder="e.g. MEGA30" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none uppercase font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Discount Type</label>
                  <select value={newCoupon.type} onChange={e => setNewCoupon({ ...newCoupon, type: e.target.value as any })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none">
                    <option value="Percentage">Percentage (%)</option>
                    <option value="Fixed Amount">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Value</label>
                  <input type="number" required value={newCoupon.discountValue} onChange={e => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCouponModal(false)} className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Publish Coupon</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
