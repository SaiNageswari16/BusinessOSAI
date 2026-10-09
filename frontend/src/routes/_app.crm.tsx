import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MockScreen } from "@/components/mock-screen";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";

// Customer Management
import { Customers } from "@/components/crm/Customers";
import { CustomerGroups } from "@/components/crm/CustomerGroups";
import { CustomerSegments } from "@/components/crm/CustomerSegments";
import { MembershipPlans } from "@/components/crm/MembershipPlans";
import { CustomerWallet } from "@/components/crm/CustomerWallet";
import { LoyaltyProgram } from "@/components/crm/LoyaltyProgram";
import { Discounts } from "@/components/crm/Discounts";
import { CustomerDocuments } from "@/components/crm/CustomerDocuments";

// Sales CRM
import { AdGenerator } from "@/components/crm/AdGenerator";
import { AdHistory } from "@/components/crm/AdHistory";
import { SocialMediaDashboard } from "@/components/crm/SocialMediaDashboard";
import { Leads } from "@/components/crm/Leads";
import { Opportunities } from "@/components/crm/Opportunities";
import { Deals } from "@/components/crm/Deals";
import { SalesPipeline } from "@/components/crm/SalesPipeline";
import { Quotations } from "@/components/crm/Quotations";
import { SalesOrders } from "@/components/crm/SalesOrders";

// Customer Service
import { SupportTickets } from "@/components/crm/SupportTickets";
import { Complaints } from "@/components/crm/Complaints";
import { Returns } from "@/components/crm/Returns";
import { Feedback } from "@/components/crm/Feedback";
import { CustomerTimeline } from "@/components/crm/CustomerTimeline";

// Communication
import { AiCallLogs } from "@/components/crm/AiCallLogs";
import { EmailCampaigns } from "@/components/crm/EmailCampaigns";
import { SmsCampaigns } from "@/components/crm/SmsCampaigns";
import { WhatsappCampaigns } from "@/components/crm/WhatsappCampaigns";
import { PushNotifications } from "@/components/crm/PushNotifications";

// Customer Intelligence
import { CustomerAnalytics } from "@/components/crm/CustomerAnalytics";
import { PurchaseBehaviour } from "@/components/crm/PurchaseBehaviour";
import { ChurnPrediction } from "@/components/crm/ChurnPrediction";
import { LifetimeValue } from "@/components/crm/LifetimeValue";
import { RfmAnalysis } from "@/components/crm/RfmAnalysis";
import { AiRecommendations } from "@/components/crm/AiRecommendations";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_app/crm")({
  component: CrmModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Customer Management
  customers: Customers,
  customer_groups: CustomerGroups,
  customer_segments: CustomerSegments,
  membership_plans: MembershipPlans,
  customer_wallet: CustomerWallet,
  loyalty_program: LoyaltyProgram,
  discounts: Discounts,
  customer_documents: CustomerDocuments,

  // Sales CRM
  ad_generator: AdGenerator,
  ad_history: AdHistory,
  social_media_dashboard: SocialMediaDashboard,
  leads: Leads,
  opportunities: Opportunities,
  deals: Deals,
  sales_pipeline: SalesPipeline,
  quotations: Quotations,
  sales_orders: SalesOrders,

  // Customer Service
  support_tickets: SupportTickets,
  complaints: Complaints,
  returns: Returns,
  feedback: Feedback,
  customer_timeline: CustomerTimeline,

  // Communication & AI Calling
  ai_call_logs: AiCallLogs,
  ai_calling: AiCallLogs,
  call_logs: AiCallLogs,
  email_campaigns: EmailCampaigns,
  sms_campaigns: SmsCampaigns,
  whatsapp_campaigns: WhatsappCampaigns,
  push_notifications: PushNotifications,

  // Customer Intelligence
  customer_analytics: CustomerAnalytics,
  purchase_behaviour: PurchaseBehaviour,
  churn_prediction: ChurnPrediction,
  lifetime_value: LifetimeValue,
  rfm_analysis: RfmAnalysis,
  ai_recommendations: AiRecommendations,
};

const tabPermissions: Record<string, string> = {
  customers: "view:crm_customers",
  customer_groups: "view:crm_groups",
  customer_segments: "view:crm_segments",
  membership_plans: "view:crm_memberships",
  customer_wallet: "view:crm_wallet",
  loyalty_program: "view:crm_loyalty",
  customer_documents: "view:crm_customers",
  discounts: "view:crm_discounts",

  ad_generator: "view:crm_campaigns",
  social_media_dashboard: "view:crm_campaigns",
  ad_history: "view:crm_campaigns",
  leads: "view:crm_leads",
  opportunities: "view:crm",
  deals: "view:crm",
  sales_pipeline: "view:crm",
  quotations: "view:crm_quotations",
  sales_orders: "view:crm_sales_orders",

  support_tickets: "view:crm_support",
  complaints: "view:crm_support",
  returns: "view:crm_support",
  feedback: "view:crm_support",
  customer_timeline: "view:crm_support",

  ai_call_logs: "view:crm",
  ai_calling: "view:crm",
  call_logs: "view:crm",
  email_campaigns: "view:crm_campaigns",
  sms_campaigns: "view:crm_campaigns",
  whatsapp_campaigns: "view:crm_campaigns",
  push_notifications: "view:crm_campaigns",

  customer_analytics: "view:analytics",
  purchase_behaviour: "view:analytics",
  churn_prediction: "view:analytics",
  lifetime_value: "view:analytics",
  rfm_analysis: "view:analytics",
  ai_recommendations: "view:analytics",
};

function CrmModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  const { hasPermission } = useRbac();

  if (!hasPermission("view:crm")) {
    return <Unauthorized />;
  }

  let activeTab = "customers";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "customers";
  }

  const requiredPerm = tabPermissions[activeTab];
  if (requiredPerm && !hasPermission(requiredPerm)) {
    return <Unauthorized />;
  }

  const formatTitle = (str: string) =>
    str.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const ActiveComponent =
    componentMap[activeTab] ||
    (() => <MockScreen type="crm" title={formatTitle(activeTab)} />);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50 p-3">
        <div key={activeTab} className="min-h-full">
          <ComponentErrorBoundary componentName={activeTab}>
            <ActiveComponent />
          </ComponentErrorBoundary>
        </div>
      </div>
    </div>
  );
}

class ComponentErrorBoundary extends React.Component<
  { componentName: string; children: React.ReactNode },
  { error: Error | null; stack: string | null }
> {
  state = { error: null as Error | null, stack: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error, stack: error.stack || null };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ComponentErrorBoundary:${this.props.componentName}]`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-bold text-red-600">Component Error: {this.props.componentName}</h2>
          <p className="text-sm text-foreground font-mono">{this.state.error.message}</p>
          <pre className="text-[10px] bg-muted p-3 rounded overflow-auto max-h-60">{this.state.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
