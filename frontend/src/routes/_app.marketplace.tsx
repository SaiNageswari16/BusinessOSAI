import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ComingSoon } from "@/components/coming-soon";

// Vendor Management
import { Vendors } from "@/components/marketplace/Vendors";
import { VendorDashboard } from "@/components/marketplace/VendorDashboard";
import { VendorCategoryManagement } from "@/components/marketplace/VendorCategoryManagement";
import { VendorContracts } from "@/components/marketplace/VendorContracts";
import { VendorPayoutsWallet } from "@/components/marketplace/VendorPayoutsWallet";
import { VendorRatings } from "@/components/marketplace/VendorRatings";
import { VendorPerformance } from "@/components/marketplace/VendorPerformance";
import { VendorApprovalsKYC } from "@/components/marketplace/VendorApprovalsKYC";

// Marketplace Products
import { MarketplaceProducts } from "@/components/marketplace/MarketplaceProducts";
import { MarketplaceCategories } from "@/components/marketplace/MarketplaceCategories";
import { MarketplaceServices } from "@/components/marketplace/MarketplaceServices";
import { MarketplaceProductApprovals } from "@/components/marketplace/MarketplaceProductApprovals";
import { MarketplacePricingRules } from "@/components/marketplace/MarketplacePricingRules";
import { MarketplaceBundles } from "@/components/marketplace/MarketplaceBundles";
import { MarketplaceFeatured } from "@/components/marketplace/MarketplaceFeatured";

// Orders
import { MarketplaceOrders } from "@/components/marketplace/MarketplaceOrders";
import { MarketplaceReturns } from "@/components/marketplace/MarketplaceReturns";
import { MarketplaceRefunds } from "@/components/marketplace/MarketplaceRefunds";
import { MarketplaceCancellations } from "@/components/marketplace/MarketplaceCancellations";
import { MarketplaceOrderTimeline } from "@/components/marketplace/MarketplaceOrderTimeline";
import { MarketplaceInvoices } from "@/components/marketplace/MarketplaceInvoices";
import { MarketplaceOrderTracking } from "@/components/marketplace/MarketplaceOrderTracking";

// Delivery
import { DeliveryPartners } from "@/components/marketplace/DeliveryPartners";
import { DeliveryDrivers } from "@/components/marketplace/DeliveryDrivers";
import { DeliveryAssignment } from "@/components/marketplace/DeliveryAssignment";
import { DeliveryTracking } from "@/components/marketplace/DeliveryTracking";
import { HyperlocalDelivery } from "@/components/marketplace/HyperlocalDelivery";
import { ShippingRules } from "@/components/marketplace/ShippingRules";
import { RoutePlanning } from "@/components/marketplace/RoutePlanning";

// Promotions & Intelligence
import { MarketplacePromotions } from "@/components/marketplace/MarketplacePromotions";
import { MarketplaceIntelligence } from "@/components/marketplace/MarketplaceIntelligence";

export const Route = createFileRoute("/_app/marketplace")({
  component: MarketplaceModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Vendor Management Sub-tabs
  vendors: Vendors,
  vendor_dashboard: VendorDashboard,
  vendor_categories: VendorCategoryManagement,
  vendor_contracts: VendorContracts,
  vendor_wallet: VendorPayoutsWallet,
  vendor_payouts: VendorPayoutsWallet,
  vendor_ratings: VendorRatings,
  vendor_performance: VendorPerformance,
  vendor_kyc: VendorApprovalsKYC,
  vendor_approvals: VendorApprovalsKYC,

  // Marketplace Products Sub-tabs
  marketplace_products: MarketplaceProducts,
  marketplace_categories: MarketplaceCategories,
  marketplace_services: MarketplaceServices,
  product_approval: MarketplaceProductApprovals,
  pricing_rules: MarketplacePricingRules,
  bundles: MarketplaceBundles,
  featured_products: MarketplaceFeatured,

  // Orders Sub-tabs
  orders: MarketplaceOrders,
  returns: MarketplaceReturns,
  refunds: MarketplaceRefunds,
  cancellations: MarketplaceCancellations,
  order_timeline: MarketplaceOrderTimeline,
  invoices: MarketplaceInvoices,
  order_tracking: MarketplaceOrderTracking,

  // Delivery Sub-tabs
  delivery_partners: DeliveryPartners,
  drivers: DeliveryDrivers,
  delivery_assignment: DeliveryAssignment,
  delivery_tracking: DeliveryTracking,
  delivery: DeliveryTracking,
  hyperlocal_delivery: HyperlocalDelivery,
  shipping_rules: ShippingRules,
  route_planning: RoutePlanning,

  // Promotions Sub-tabs
  coupons: MarketplacePromotions,
  offers: MarketplacePromotions,
  campaigns: MarketplacePromotions,
  flash_sales: MarketplacePromotions,
  wallet: MarketplacePromotions,
  loyalty: MarketplacePromotions,
  gift_cards: MarketplacePromotions,

  // Intelligence Sub-tabs
  demand_forecast: MarketplaceIntelligence,
  dynamic_pricing: MarketplaceIntelligence,
  vendor_analytics: MarketplaceIntelligence,
  product_analytics: MarketplaceIntelligence,
  fraud_detection: MarketplaceIntelligence,
  ai_recommendations: MarketplaceIntelligence,
};

function MarketplaceModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;

  let activeTab = "vendors";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "vendors";
  }

  const formatTitle = (str: string) => str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const ActiveComponent = componentMap[activeTab] || (() => <ComingSoon title={formatTitle(activeTab)} />);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}