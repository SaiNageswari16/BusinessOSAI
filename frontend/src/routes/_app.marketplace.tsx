import React, { useState } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";
import {
  Store, Package, ShoppingCart, Truck, Tags, Activity,
  Search, Filter, Plus, ShieldCheck, FileCheck, CreditCard,
  Clock, Star, MapPin, CheckCircle2, AlertTriangle, Wallet,
  Calendar, RefreshCw, Layers, ArrowUpRight, ArrowDownRight,
  TrendingUp, Download, Eye, Check
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { Vendors } from "@/components/marketplace/Vendors";
import { VendorDashboard } from "@/components/marketplace/VendorDashboard";
import { MarketplaceProducts } from "@/components/marketplace/MarketplaceProducts";
import { MarketplaceOrders } from "@/components/marketplace/MarketplaceOrders";
import { DeliveryTracking } from "@/components/marketplace/DeliveryTracking";
import { B2BPricingRules } from "@/components/marketplace/B2BPricingRules";
import { MarketplaceRFQ } from "@/components/marketplace/MarketplaceRFQ";
import { TradeCreditManager } from "@/components/marketplace/TradeCreditManager";
import {
  AddVendorModal, AddProductModal, AddCouponModal, CreatePayoutModal
} from "@/components/marketplace/MarketplaceModals";

export const Route = createFileRoute("/_app/marketplace")({
  component: MarketplaceModule,
});

/* ── Generic Sub-Tab Table Component with Search, Actions & Live Data ── */
function SubTabTableView({
  title,
  subtitle,
  icon: Icon,
  actionButtonText,
  onActionClick,
  columns,
  data,
  isLoading,
}: {
  title: string;
  subtitle: string;
  icon: any;
  actionButtonText?: string;
  onActionClick?: () => void;
  columns: { header: string; align?: "left" | "center" | "right"; render: (row: any) => React.ReactNode }[];
  data: any[];
  isLoading?: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = (data || []).filter((item) =>
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 shrink-0">
              <Icon className="size-4" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 pl-10.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <button className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer">
            <Filter className="size-4" /> Filter
          </button>
          {actionButtonText && onActionClick && (
            <button
              onClick={onActionClick}
              className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Plus className="size-4" /> {actionButtonText}
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      "px-6 py-4 whitespace-nowrap",
                      col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-6 py-4">
                      <Skeleton className="h-5 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Icon className="size-5" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">No records found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search query or add a new record.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-muted/30 transition-colors">
                    {columns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className={cn(
                          "px-6 py-4",
                          col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MarketplaceModule() {
  const { hasPermission } = useRbac();
  const routerState = useRouterState();
  const queryClient = useQueryClient();
  const searchStr = routerState.location.searchStr;
  const { currency } = useCurrency();

  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [isCreatePayoutOpen, setIsCreatePayoutOpen] = useState(false);

  if (!hasPermission("view:marketplace")) {
    return <Unauthorized />;
  }

  let activeTab = "vendors";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "vendors";
  }

  // Live Real Backend Queries
  const { data: apiVendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ["marketplace-vendors"],
    queryFn: () => marketplaceApi.getVendors(),
    staleTime: 30000,
  });

  const { data: apiCategories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["marketplace-categories"],
    queryFn: () => marketplaceApi.getVendorCategories(),
    staleTime: 30000,
  });

  const { data: apiContracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["marketplace-contracts"],
    queryFn: () => marketplaceApi.getVendorContracts(),
    staleTime: 30000,
  });

  const { data: apiPayouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ["marketplace-payouts"],
    queryFn: () => marketplaceApi.getPayouts(),
    staleTime: 30000,
  });

  const { data: apiCoupons, isLoading: couponsLoading } = useQuery({
    queryKey: ["marketplace-coupons"],
    queryFn: () => marketplaceApi.getCoupons(),
    staleTime: 30000,
  });

  const { data: apiPartners, isLoading: partnersLoading } = useQuery({
    queryKey: ["marketplace-partners"],
    queryFn: () => marketplaceApi.getDeliveryPartners(),
    staleTime: 30000,
  });

  const kycMutation = useMutation({
    mutationFn: ({ vendorId, status }: { vendorId: string; status: string }) =>
      marketplaceApi.updateKYC(vendorId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-vendors"] });
    },
  });

  const currentVendors = apiVendors || [];
  const currentCategories = apiCategories || [];
  const currentContracts = apiContracts || [];
  const currentPayouts = apiPayouts || [];
  const currentCoupons = apiCoupons || [];
  const currentPartners = apiPartners || [];

  const renderContent = () => {
    switch (activeTab) {
      case "vendors":
        return <Vendors />;

      case "vendor_categories":
      case "marketplace_categories":
        return (
          <SubTabTableView
            title="Vendor & Product Categories"
            subtitle="Manage commission rates, marketplace taxonomies, and merchant listings."
            icon={Layers}
            isLoading={categoriesLoading}
            data={currentCategories}
            columns={[
              { header: "Category ID", render: (r) => <span className="font-mono font-bold text-slate-700">{r.id}</span> },
              { header: "Category Name", render: (r) => <span className="font-bold text-foreground text-sm">{r.name}</span> },
              { header: "Platform Commission", align: "center", render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">{r.commissionRate}</span> },
              { header: "Active Vendors", align: "right", render: (r) => <span className="font-bold text-slate-900">{r.vendorCount} merchants</span> },
              { header: "Listings", align: "right", render: (r) => <span className="font-semibold text-slate-700">{r.activeListings} items</span> },
              { header: "Status", align: "center", render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">{r.status}</span> },
            ]}
          />
        );

      case "vendor_contracts":
        return (
          <SubTabTableView
            title="Vendor Contracts & Agreements"
            subtitle="Review legal contracts, revenue share agreements, and vendor SLAs."
            icon={FileCheck}
            isLoading={contractsLoading}
            data={currentContracts}
            columns={[
              { header: "Contract ID", render: (r) => <span className="font-mono font-bold text-slate-700">{r.id}</span> },
              { header: "Vendor Name", render: (r) => <span className="font-bold text-foreground text-sm">{r.vendor}</span> },
              { header: "Agreement Type", render: (r) => <span className="text-slate-600">{r.type}</span> },
              { header: "Commission", align: "center", render: (r) => <span className="font-bold text-purple-700">{r.commission}</span> },
              { header: "Start Date", render: (r) => <span className="text-muted-foreground">{r.startDate}</span> },
              { header: "Expiry Date", render: (r) => <span className="text-muted-foreground">{r.expiryDate}</span> },
              { header: "SLA Metric", align: "center", render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">{r.sla}</span> },
              { header: "Status", align: "center", render: (r) => <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border", r.status === "Active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200")}>{r.status}</span> },
            ]}
          />
        );

      case "vendor_wallet":
      case "vendor_payouts":
        return (
          <SubTabTableView
            title="Vendor Wallet & Settlement Payouts"
            subtitle="Track automated escrow settlements, bank wire disbursements, and ledger balances."
            icon={Wallet}
            actionButtonText="Initiate Settlement"
            onActionClick={() => setIsCreatePayoutOpen(true)}
            isLoading={payoutsLoading}
            data={currentPayouts}
            columns={[
              { header: "Payout ID", render: (r) => <span className="font-mono font-bold text-slate-700">{r.id}</span> },
              { header: "Vendor Name", render: (r) => <span className="font-bold text-foreground text-sm">{r.vendorName || r.vendor}</span> },
              { header: "Disbursed Amount", align: "right", render: (r) => <span className="font-black text-foreground text-sm">{currency.symbol}{Number(r.amount || 0).toLocaleString()}</span> },
              { header: "Transfer Method", render: (r) => <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"><CreditCard className="size-3 text-slate-500" /> {r.method}</span> },
              { header: "Bank Ref", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.bankRef}</span> },
              { header: "Date", render: (r) => <span className="text-muted-foreground">{r.date}</span> },
              { header: "Status", align: "center", render: (r) => <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border", r.status === "Cleared" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200")}>{r.status}</span> },
            ]}
          />
        );

      case "vendor_kyc":
      case "vendor_approvals":
        return (
          <SubTabTableView
            title="Vendor KYC & Compliance Approvals"
            subtitle="Audit merchant trade licenses, TRN tax certificates, and identity verification."
            icon={ShieldCheck}
            actionButtonText="Onboard Vendor"
            onActionClick={() => setIsAddVendorOpen(true)}
            isLoading={vendorsLoading}
            data={currentVendors}
            columns={[
              { header: "Vendor ID", render: (r) => <span className="font-mono font-bold text-slate-700">{r.id}</span> },
              { header: "Vendor Name", render: (r) => <span className="font-bold text-foreground text-sm">{r.name}</span> },
              { header: "Trade License #", render: (r) => <span className="font-mono text-slate-700">{r.trade_license || "DED-1049281"}</span> },
              { header: "Tax TRN", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.tax_trn || "TRN-10049281900003"}</span> },
              { header: "Location", render: (r) => <span className="text-slate-700">{r.location}</span> },
              {
                header: "KYC Status",
                align: "center",
                render: (r) => (
                  <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                    r.kyc_status === "Approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    r.kyc_status === "Pending" ? "bg-amber-50 text-amber-600 border-amber-200" :
                    "bg-rose-50 text-rose-600 border-rose-200"
                  )}>
                    {r.kyc_status || "Approved"}
                  </span>
                ),
              },
              {
                header: "Action",
                align: "right",
                render: (r) => (
                  r.kyc_status === "Pending" ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => kycMutation.mutate({ vendorId: r.id, status: "Approved" })}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => kycMutation.mutate({ vendorId: r.id, status: "Rejected" })}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-600">✓ Verified</span>
                  )
                ),
              },
            ]}
          />
        );

      case "pricing_rules":
        return <B2BPricingRules />;

      case "rfqs":
      case "vendor_contracts":
        return <MarketplaceRFQ />;

      case "trade_credit":
        return <TradeCreditManager />;

      case "marketplace_products":
      case "product_approval":
      case "featured_products":
      case "bundles":
      case "marketplace_services":
        return <MarketplaceProducts />;

      case "orders":
      case "returns":
      case "refunds":
      case "cancellations":
      case "order_timeline":
      case "invoices":
        return <MarketplaceOrders />;

      case "delivery":
      case "delivery_tracking":
      case "order_tracking":
      case "hyperlocal_delivery":
        return <DeliveryTracking />;

      case "delivery_partners":
      case "drivers":
      case "delivery_assignment":
      case "shipping_rules":
      case "route_planning":
        return (
          <SubTabTableView
            title="Logistics & Delivery Partners"
            subtitle="Manage integrated courier fleets, dispatch SLAs, and driver allocation."
            icon={Truck}
            isLoading={partnersLoading}
            data={currentPartners}
            columns={[
              { header: "Partner ID", render: (r) => <span className="font-mono font-bold text-slate-700">{r.id}</span> },
              { header: "Courier Company", render: (r) => <span className="font-bold text-foreground text-sm">{r.name}</span> },
              { header: "Active Drivers", align: "right", render: (r) => <span className="font-bold text-slate-900">{r.drivers} couriers</span> },
              { header: "Coverage Zone", render: (r) => <span className="inline-flex items-center gap-1 text-slate-700"><MapPin className="size-3 text-slate-400" /> {r.zone}</span> },
              { header: "Rating", align: "center", render: (r) => <span className="inline-flex items-center gap-1 font-bold text-slate-800"><Star className="size-3 text-amber-500 fill-amber-500" /> {r.rating}</span> },
              { header: "SLA Compliance", align: "center", render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{r.sla}</span> },
              { header: "Active Deliveries", align: "right", render: (r) => <span className="font-bold text-purple-700">{r.activeOrders} live</span> },
              { header: "Status", align: "center", render: (r) => <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">{r.status}</span> },
            ]}
          />
        );

      case "coupons":
      case "offers":
      case "flash_sales":
      case "gift_cards":
        return (
          <SubTabTableView
            title="Marketplace Coupons & Promotions"
            subtitle="Configure discount vouchers, vendor-funded campaigns, and flash sale promo codes."
            icon={Tags}
            actionButtonText="Create Coupon"
            onActionClick={() => setIsAddCouponOpen(true)}
            isLoading={couponsLoading}
            data={currentCoupons}
            columns={[
              { header: "Promo Code", render: (r) => <span className="font-mono font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">{r.code}</span> },
              { header: "Discount Value", render: (r) => <span className="font-bold text-foreground">{r.discount}</span> },
              { header: "Minimum Order", align: "center", render: (r) => <span className="text-slate-700">{r.minOrder}</span> },
              { header: "Redemptions", align: "right", render: (r) => <span className="font-bold text-slate-900">{r.usedCount} / {r.maxUsage}</span> },
              { header: "Valid Until", render: (r) => <span className="text-muted-foreground">{r.expiry}</span> },
              { header: "Status", align: "center", render: (r) => <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">{r.status}</span> },
            ]}
          />
        );

      case "vendor_dashboard":
      case "vendor_performance":
      case "vendor_ratings":
      case "vendor_analytics":
      case "product_analytics":
      case "demand_forecast":
      case "fraud_detection":
      case "ai_recommendations":
      case "campaigns":
      case "loyalty":
      case "wallet":
      default:
        return <VendorDashboard />;
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background p-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="min-h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Dialog Modals ── */}
      <AddVendorModal isOpen={isAddVendorOpen} onClose={() => setIsAddVendorOpen(false)} />
      <AddProductModal isOpen={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />
      <AddCouponModal isOpen={isAddCouponOpen} onClose={() => setIsAddCouponOpen(false)} />
      <CreatePayoutModal isOpen={isCreatePayoutOpen} onClose={() => setIsCreatePayoutOpen(false)} />
    </div>
  );
}
