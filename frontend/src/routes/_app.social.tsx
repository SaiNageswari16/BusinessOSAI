import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";
import { MockScreen } from "@/components/mock-screen";

// Social Media & Marketing Components
import { SocialMediaDashboard } from "@/components/crm/SocialMediaDashboard";
import { AdGenerator } from "@/components/crm/AdGenerator";
import { AdHistory } from "@/components/crm/AdHistory";
import { SocialContentScheduler } from "@/components/social/SocialContentScheduler";
import { SocialChannelsIntegrations } from "@/components/social/SocialChannelsIntegrations";

export const Route = createFileRoute("/_app/social")({
  component: SocialModule,
});

const componentMap: Record<string, React.ElementType> = {
  dashboard: SocialMediaDashboard,
  calendar: SocialContentScheduler,
  ad_generator: AdGenerator,
  ad_history: AdHistory,
  channels: SocialChannelsIntegrations,
};

const tabPermissions: Record<string, string> = {
  dashboard: "view:social_media",
  calendar: "view:social_media",
  ad_generator: "create:social_media_posts",
  ad_history: "view:social_media",
  channels: "manage:social_media_connections",
};

function SocialModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  const { hasPermission } = useRbac();

  if (!hasPermission("view:social_media") && !hasPermission("view:crm") && !hasPermission("view:dashboard")) {
    return <Unauthorized />;
  }

  let activeTab = "dashboard";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "dashboard";
  }

  const requiredPerm = tabPermissions[activeTab];
  if (requiredPerm && !hasPermission(requiredPerm) && !hasPermission("view:crm") && !hasPermission("manage:crm")) {
    return <Unauthorized />;
  }

  const formatTitle = (str: string) =>
    str
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const ActiveComponent =
    componentMap[activeTab] ||
    (() => <MockScreen type="social" title={formatTitle(activeTab)} />);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50 p-3 sm:p-5">
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
    console.error(`[ComponentErrorBoundary:Social:${this.props.componentName}]`, error, info);
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
