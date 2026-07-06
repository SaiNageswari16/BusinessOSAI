import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MockScreen } from "@/components/mock-screen";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsModule,
});

const componentMap: Record<string, React.ElementType> = {
  executive_dashboard: () => <MockScreen type="analytics" title="Executive Dashboard" />,
};

function ReportsModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  
  let activeTab = "executive_dashboard";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "executive_dashboard";
  }

  const formatTitle = (str: string) => str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const ActiveComponent = componentMap[activeTab] || (() => <MockScreen type="analytics" title={formatTitle(activeTab)} />);

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
