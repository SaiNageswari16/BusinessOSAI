import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ComingSoon } from "@/components/coming-soon";

import { Vendors } from "@/components/marketplace/Vendors";
import { VendorDashboard } from "@/components/marketplace/VendorDashboard";
import { MarketplaceProducts } from "@/components/marketplace/MarketplaceProducts";
import { MarketplaceOrders } from "@/components/marketplace/MarketplaceOrders";
import { DeliveryTracking } from "@/components/marketplace/DeliveryTracking";

export const Route = createFileRoute("/_app/marketplace")({
  component: MarketplaceModule,
});

const componentMap: Record<string, React.ElementType> = {
  vendors: Vendors,
  vendor_dashboard: VendorDashboard,
  marketplace_products: MarketplaceProducts,
  orders: MarketplaceOrders,
  delivery: DeliveryTracking,
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
