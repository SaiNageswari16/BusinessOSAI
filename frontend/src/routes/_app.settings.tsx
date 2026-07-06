import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MockScreen } from "@/components/mock-screen";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsModule,
});

const componentMap: Record<string, React.ElementType> = {
  company_profile: () => <MockScreen type="settings" title="Company Profile" />,
};

function SettingsModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  
  let activeTab = "company_profile";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "company_profile";
  }

  const formatTitle = (str: string) => str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const ActiveComponent = componentMap[activeTab] || (() => <MockScreen type="settings" title={formatTitle(activeTab)} />);

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
