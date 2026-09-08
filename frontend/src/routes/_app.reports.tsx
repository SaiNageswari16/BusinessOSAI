import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";
import * as Screens from "@/components/reports/screens";
import { ReportsHub } from "@/components/reports/ReportsHub";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Report Builder Sub-tabs
  custom_reports: ReportsHub,
  saved_reports: Screens.SavedReports,
  scheduled_reports: Screens.ScheduledReports,
  exports: Screens.Exports,

  // Sales & Revenue
  sales_reports: Screens.SalesReports,
  revenue_reports: Screens.RevenueReports,
  branch_reports: Screens.BranchReports,
  pos_reports: Screens.PosReports,

  // Inventory & Logistics
  stock_reports: Screens.StockReports,
  movement_reports: Screens.MovementReports,
  warehouse_reports: Screens.WarehouseReports,
  abc_analysis_reports: Screens.AbcAnalysisReports,
  xyz_analysis_reports: Screens.XyzAnalysisReports,

  // Procurement & Vendors
  purchase_reports: Screens.PurchaseReports,
  supplier_reports: Screens.SupplierReports,
  grn_reports: Screens.GrnReports,
  spend_analysis_reports: Screens.SpendAnalysisReports,

  // Customers & CRM
  customer_reports: Screens.CustomerReports,
  lead_reports: Screens.LeadReports,
  loyalty_reports: Screens.LoyaltyReports,
  campaign_reports: Screens.CampaignReports,

  // Marketplace & Fulfilment
  vendor_reports: Screens.VendorReports,
  marketplace_revenue: Screens.MarketplaceRevenue,
  delivery_reports: Screens.DeliveryReports,
  order_reports: Screens.OrderReports,

  // HR & Payroll
  attendance_reports: Screens.AttendanceReports,
  payroll_reports: Screens.PayrollReports,
  recruitment_reports: Screens.RecruitmentReports,
  performance_reports: Screens.PerformanceReports,

  // Finance & Accounting
  pnl_reports: Screens.PnlReports,
  balance_sheet_reports: Screens.BalanceSheetReports,
  cash_flow_reports: Screens.CashFlowReports,
  gst_reports: Screens.GstReports,
  expense_reports: Screens.ExpenseReports,

  // AI & Forecasting
  revenue_prediction: Screens.RevenuePrediction,
  demand_forecast_reports: Screens.DemandForecastReports,
  inventory_forecast: Screens.InventoryForecast,
  customer_prediction: Screens.CustomerPrediction,
  attrition_prediction_reports: Screens.AttritionPredictionReports,
  fraud_detection_reports: Screens.FraudDetectionReports,
};

function ReportsModule() {
  const { hasPermission } = useRbac();
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr || "";

  if (!hasPermission("view:reports") && !hasPermission("view:analytics")) {
    return <Unauthorized />;
  }

  let activeTab = "custom_reports";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "custom_reports";
  }

  const ActiveComponent = componentMap[activeTab] || ReportsHub;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="min-h-full flex-1"
        >
          <ComponentErrorBoundary componentName={activeTab}>
            <ActiveComponent />
          </ComponentErrorBoundary>
        </motion.div>
      </AnimatePresence>
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
