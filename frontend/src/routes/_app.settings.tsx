import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MockScreen } from "@/components/mock-screen";
import { RecruitmentIntegrations } from "@/components/recruitment-integrations";
import { NotificationSettings } from "@/components/NotificationSettings";
import { EmailCampaigns } from "@/components/crm/EmailCampaigns";
import { PushNotifications } from "@/components/crm/PushNotifications";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsModule,
});

function SystemNotificationsTab() {
  const [subTab, setSubTab] = React.useState<"logs" | "settings">("logs");
  return (
    <div className="space-y-2">
      <div className="px-6 pt-4 flex gap-4 border-b border-border/50 bg-card">
        <button
          onClick={() => setSubTab("logs")}
          className={`px-3 py-2 text-sm font-bold border-b-2 bg-transparent border-none cursor-pointer transition-colors ${
            subTab === "logs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Live Notifications Log
        </button>
        <button
          onClick={() => setSubTab("settings")}
          className={`px-3 py-2 text-sm font-bold border-b-2 bg-transparent border-none cursor-pointer transition-colors ${
            subTab === "settings" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Alert Settings & Frequencies
        </button>
      </div>
      <div>
        {subTab === "logs" ? <PushNotifications /> : <NotificationSettings />}
      </div>
    </div>
  );
}

const componentMap: Record<string, React.ElementType> = {
  company_profile: () => <MockScreen type="settings" title="Company Profile" />,
  recruitment_integrations: RecruitmentIntegrations,
  notifications: SystemNotificationsTab,
  email_integration: EmailCampaigns,
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
