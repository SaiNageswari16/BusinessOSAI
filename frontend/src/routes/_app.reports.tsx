import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";
import { ReportsHub } from "@/components/reports/ReportsHub";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsModule,
});

function ReportsModule() {
  const { hasPermission } = useRbac();

  if (!hasPermission("view:reports") && !hasPermission("view:analytics")) {
    return <Unauthorized />;
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <ComponentErrorBoundary componentName="ReportsHub">
        <ReportsHub />
      </ComponentErrorBoundary>
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
    console.error(`ErrorBoundary caught an error in ${this.props.componentName}:`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-center text-red-500 bg-red-500/5 rounded-xl border border-red-500/20 m-6">
          <h2 className="text-xl font-bold mb-2">Failed to load component: {this.props.componentName}</h2>
          <p className="font-mono text-sm opacity-80">{this.state.error.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
