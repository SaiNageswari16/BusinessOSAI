import React, { useState, useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BrainCircuit, TrendingUp, DollarSign, ShieldAlert, Sparkles, PieChart,
  LineChart, Cpu, ArrowUpRight, BarChart3, Store, Package, Activity, AlertOctagon, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/marketplace-api";

interface DemandForecast {
  category: string;
  currentDemand: string;
  projectedGrowth: string;
  recommendedStock: number;
  confidence: number;
}

interface DynamicPriceRule {
  item: string;
  basePrice: number;
  optimizedPrice: number;
  marginImpact: string;
  status: "Active" | "Suggested";
}

interface VendorAnalyticsItem {
  vendorName: string;
  vendorCode: string;
  category: string;
  totalRevenue: number;
  fulfillmentRate: number; // percentage
  commissionGenerated: number;
  rating: number;
}

interface ProductAnalyticsItem {
  productName: string;
  sku: string;
  category: string;
  unitsSold: number;
  revenue: number;
  conversionRate: number; // percentage
  returnRate: number; // percentage
}

interface FraudAlert {
  id: string;
  vendor: string;
  type: string;
  riskScore: number;
  level: "High Risk" | "Low Risk" | "Medium Risk";
  detail: string;
}

export function MarketplaceIntelligence() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  
  let currentTabFromUrl = "demand_forecast";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    currentTabFromUrl = params.get("tab") || "demand_forecast";
  }

  const [activeTab, setActiveTab] = useState<
    "demand_forecast" | "dynamic_pricing" | "vendor_analytics" | "product_analytics" | "fraud_detection" | "ai_recommendations"
  >("demand_forecast");

  useEffect(() => {
    if (["demand_forecast", "dynamic_pricing", "vendor_analytics", "product_analytics", "fraud_detection", "ai_recommendations"].includes(currentTabFromUrl)) {
      setActiveTab(currentTabFromUrl as any);
    }
  }, [currentTabFromUrl]);

  // Dynamic Datasets with API fallbacks
  const [demandForecasts, setDemandForecasts] = useState<DemandForecast[]>([
    { category: "Electronics & Monitors", currentDemand: "High", projectedGrowth: "+34%", recommendedStock: 450, confidence: 94 },
    { category: "Ergonomic Furniture", currentDemand: "Steady", projectedGrowth: "+18%", recommendedStock: 210, confidence: 89 },
    { category: "Industrial Hardware", currentDemand: "Surging", projectedGrowth: "+52%", recommendedStock: 800, confidence: 96 },
    { category: "Office Stationery", currentDemand: "Moderate", projectedGrowth: "+5%", recommendedStock: 120, confidence: 82 },
  ]);

  useEffect(() => {
    marketplaceApi.getDemandForecast().then(data => {
      if (data.forecasts && data.forecasts.length > 0) {
        setDemandForecasts(data.forecasts);
      }
    }).catch(() => {});
  }, []);

  const dynamicPricingRules: DynamicPriceRule[] = [
    { item: "Ultra HD Smart LED Monitor 32-Inch", basePrice: 189.99, optimizedPrice: 199.99, marginImpact: "+5.2%", status: "Active" },
    { item: "Ergonomic Executive Office Chair", basePrice: 245.00, optimizedPrice: 239.00, marginImpact: "+12.4% Volume", status: "Active" },
    { item: "Precision Industrial Tool Set", basePrice: 320.00, optimizedPrice: 329.50, marginImpact: "+3.0%", status: "Suggested" },
  ];

  const vendorAnalyticsData: VendorAnalyticsItem[] = [
    { vendorName: "Apex Tech Solutions", vendorCode: "APEX", category: "Electronics", totalRevenue: 145000, fulfillmentRate: 98.4, commissionGenerated: 12325, rating: 4.9 },
    { vendorName: "Nexus Supply Chain", vendorCode: "NEXS", category: "Industrial Tools", totalRevenue: 310000, fulfillmentRate: 99.1, commissionGenerated: 24800, rating: 4.8 },
    { vendorName: "Global Logistics Hub", vendorCode: "GLOG", category: "Logistics & Freight", totalRevenue: 92000, fulfillmentRate: 94.2, commissionGenerated: 7360, rating: 4.7 },
    { vendorName: "Urban Retail Group", vendorCode: "URBN", category: "Fashion & Lifestyle", totalRevenue: 45000, fulfillmentRate: 78.5, commissionGenerated: 3600, rating: 3.2 },
  ];

  const productAnalyticsData: ProductAnalyticsItem[] = [
    { productName: "Ultra HD Smart LED Monitor 32-Inch", sku: "SKU-MON-32", category: "Electronics", unitsSold: 1420, revenue: 269785.80, conversionRate: 4.8, returnRate: 0.6 },
    { productName: "Ergonomic Executive Office Chair", sku: "SKU-CHR-01", category: "Furniture", unitsSold: 980, revenue: 240100.00, conversionRate: 3.9, returnRate: 1.2 },
    { productName: "Precision Industrial Tool Set 120-Piece", sku: "SKU-TLS-120", category: "Industrial Tools", unitsSold: 2150, revenue: 688000.00, conversionRate: 5.4, returnRate: 0.2 },
  ];

  const fraudAlerts: FraudAlert[] = [
    { id: "FRD-401", vendor: "Urban Retail Group", type: "Multiple Account Velocity", riskScore: 78, level: "High Risk", detail: "Abnormal surge of duplicate high-value orders from single IP block." },
    { id: "FRD-402", vendor: "Apex Tech Solutions", type: "Chargeback Pattern Check", riskScore: 12, level: "Low Risk", detail: "Standard transaction verification passed." },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Marketplace AI Intelligence & Analytics</h1>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Sparkles className="size-3" /> Antigravity AI Engine
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Demand forecasting, dynamic price optimization, vendor/product analytics, and fraud risk detection.</p>
        </div>
      </div>

      {/* 6 Sub-Tab Navigation Bar */}
      <div className="flex border-b border-border/50 gap-4 overflow-x-auto text-xs font-semibold">
        <button 
          onClick={() => setActiveTab("demand_forecast")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "demand_forecast" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <TrendingUp className="size-3.5" /> Demand Forecast
        </button>
        <button 
          onClick={() => setActiveTab("dynamic_pricing")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "dynamic_pricing" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <DollarSign className="size-3.5 text-emerald-500" /> Dynamic Pricing
        </button>
        <button 
          onClick={() => setActiveTab("vendor_analytics")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "vendor_analytics" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <LineChart className="size-3.5 text-purple-500" /> Vendor Analytics
        </button>
        <button 
          onClick={() => setActiveTab("product_analytics")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "product_analytics" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <PieChart className="size-3.5 text-sky-500" /> Product Analytics
        </button>
        <button 
          onClick={() => setActiveTab("fraud_detection")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "fraud_detection" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ShieldAlert className="size-3.5 text-red-500" /> Fraud Detection ({fraudAlerts.filter(f => f.riskScore > 50).length})
        </button>
        <button 
          onClick={() => setActiveTab("ai_recommendations")}
          className={cn("pb-2.5 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5",
            activeTab === "ai_recommendations" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BrainCircuit className="size-3.5 text-amber-500" /> AI Recommendations
        </button>
      </div>

      {/* 1. DEMAND FORECAST VIEW */}
      {activeTab === "demand_forecast" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {demandForecasts.map((f, i) => (
              <motion.div
                key={f.category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-panel p-5 rounded-xl border border-border/50 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-foreground text-sm truncate max-w-[150px]" title={f.category}>{f.category}</h3>
                  <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5">
                    {f.projectedGrowth} <ArrowUpRight className="size-3.5" />
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground bg-background/50 p-3 rounded-lg border border-border/40">
                  <div className="flex justify-between">
                    <span>Demand Status:</span>
                    <span className="font-semibold text-foreground">{f.currentDemand}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Reorder Qty:</span>
                    <span className="font-semibold text-primary font-mono">{f.recommendedStock} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Confidence:</span>
                    <span className="font-semibold text-emerald-600">{f.confidence}%</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 2. DYNAMIC PRICING VIEW */}
      {activeTab === "dynamic_pricing" && (
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <DollarSign className="size-4 text-emerald-500" /> AI Dynamic Price Optimization Rules
            </h3>
            <span className="text-xs text-muted-foreground">Adjusting prices based on competitor intelligence & demand velocity</span>
          </div>

          <div className="divide-y divide-border/40 p-4 space-y-3">
            {dynamicPricingRules.map((p) => (
              <div key={p.item} className="pt-3 first:pt-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">{p.item}</h4>
                  <p className="text-muted-foreground">Base Price: <span className="line-through">${p.basePrice}</span></p>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">AI Recommended Price</span>
                    <p className="font-extrabold text-foreground text-sm font-mono text-emerald-500">${p.optimizedPrice}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase">Margin Gain</span>
                    <p className="font-bold text-foreground">{p.marginImpact}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. VENDOR ANALYTICS VIEW */}
      {activeTab === "vendor_analytics" && (
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Store className="size-4 text-primary" /> Vendor Revenue & Performance Matrix
            </h3>
            <span className="text-xs text-muted-foreground">Aggregated across all verified marketplace sellers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="bg-muted/40 uppercase font-semibold text-[10px] text-foreground border-b border-border/50">
                <tr>
                  <th className="p-3.5">Vendor</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Total GMV Revenue</th>
                  <th className="p-3.5">Fulfillment Rate</th>
                  <th className="p-3.5">Commission Earned</th>
                  <th className="p-3.5 text-right">Rating Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {vendorAnalyticsData.map((v, i) => (
                  <motion.tr
                    key={v.vendorCode}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-accent/30 transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-foreground">{v.vendorName} ({v.vendorCode})</td>
                    <td className="p-3.5">{v.category}</td>
                    <td className="p-3.5 font-bold font-mono text-foreground">${v.totalRevenue.toLocaleString()}</td>
                    <td className="p-3.5 font-semibold text-emerald-600">{v.fulfillmentRate}%</td>
                    <td className="p-3.5 font-bold font-mono text-emerald-500">${v.commissionGenerated.toLocaleString()}</td>
                    <td className="p-3.5 text-right font-bold text-amber-500">★ {v.rating}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PRODUCT ANALYTICS VIEW */}
      {activeTab === "product_analytics" && (
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Package className="size-4 text-sky-500" /> Top Performing SKUs & Revenue Breakdown
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="bg-muted/40 uppercase font-semibold text-[10px] text-foreground border-b border-border/50">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">SKU</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Units Sold</th>
                  <th className="p-3.5">Conversion Rate</th>
                  <th className="p-3.5 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {productAnalyticsData.map((p, i) => (
                  <motion.tr
                    key={p.sku}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-accent/30 transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-foreground">{p.productName}</td>
                    <td className="p-3.5 font-mono text-[10px] text-muted-foreground">{p.sku}</td>
                    <td className="p-3.5">{p.category}</td>
                    <td className="p-3.5 font-bold font-mono text-foreground">{p.unitsSold}</td>
                    <td className="p-3.5 font-semibold text-emerald-600">{p.conversionRate}%</td>
                    <td className="p-3.5 text-right font-bold font-mono text-emerald-500">${p.revenue.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. FRAUD DETECTION VIEW */}
      {activeTab === "fraud_detection" && (
        <div className="space-y-4">
          {fraudAlerts.map((frd) => (
            <div key={frd.id} className="glass-panel p-5 rounded-xl border border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    frd.riskScore > 50 ? "bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse" : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  )}>
                    {frd.level} ({frd.riskScore}/100)
                  </span>
                  <h4 className="font-bold text-foreground text-sm">{frd.vendor}</h4>
                </div>
                <p className="text-xs text-muted-foreground">{frd.detail}</p>
              </div>

              <button className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-foreground font-medium rounded-lg text-xs transition-colors">
                Investigate Risk Flag
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 6. AI RECOMMENDATIONS VIEW */}
      {activeTab === "ai_recommendations" && (
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-bold text-foreground text-base flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Strategic Vendor & Catalog Growth Insights
          </h3>
          <ul className="space-y-3 text-xs text-muted-foreground list-disc pl-5">
            <li><strong className="text-foreground">Category Expansion:</strong> High customer search volume detected for "Industrial Power Storage" with 0 local vendor listings. Onboard verified energy vendors.</li>
            <li><strong className="text-foreground">Vendor Incentive:</strong> Apex Tech Solutions qualifies for Tier-1 Commission rebate (3.5% reduction) due to zero return rate in Q3.</li>
            <li><strong className="text-foreground">Cross-Selling Synergy:</strong> 42% of buyers purchasing office chairs also view monitor mounts. Enable automated bundling.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
