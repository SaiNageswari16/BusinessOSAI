import React from "react";
import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, LineChart as LucideLineChart, Building2, ShoppingCart, Boxes, ArrowRightLeft,
  Warehouse, PieChart, ShoppingBag, Truck, FileCheck, Calculator,
  Users, UserCog, Tags, Radio, Store, Clock, CreditCard, Briefcase,
  Target, BrainCircuit, Skull, ShieldCheck, Settings, Activity
} from "lucide-react";

import * as Screens from "@/components/reports/screens";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsModule,
});

const componentMap: Record<string, React.ElementType> = {
  sales_reports: Screens.SalesReports,
  revenue_reports: Screens.RevenueReports,
  branch_reports: Screens.BranchReports,
  pos_reports: Screens.PosReports,
  stock_reports: Screens.StockReports,
  movement_reports: Screens.MovementReports,
  warehouse_reports: Screens.WarehouseReports,
  abc_analysis_reports: Screens.AbcAnalysisReports,
  xyz_analysis_reports: Screens.XyzAnalysisReports,
  purchase_reports: Screens.PurchaseReports,
  supplier_reports: Screens.SupplierReports,
  grn_reports: Screens.GrnReports,
  spend_analysis_reports: Screens.SpendAnalysisReports,
  customer_reports: Screens.CustomerReports,
  lead_reports: Screens.LeadReports,
  loyalty_reports: Screens.LoyaltyReports,
  campaign_reports: Screens.CampaignReports,
  vendor_reports: Screens.VendorReports,
  marketplace_revenue: Screens.MarketplaceRevenue,
  delivery_reports: Screens.DeliveryReports,
  order_reports: Screens.OrderReports,
  attendance_reports: Screens.AttendanceReports,
  payroll_reports: Screens.PayrollReports,
  recruitment_reports: Screens.RecruitmentReports,
  performance_reports: Screens.PerformanceReports,
  pnl_reports: Screens.PnlReports,
  balance_sheet_reports: Screens.BalanceSheetReports,
  cash_flow_reports: Screens.CashFlowReports,
  gst_reports: Screens.GstReports,
  expense_reports: Screens.ExpenseReports,
  revenue_prediction: Screens.RevenuePrediction,
  demand_forecast_reports: Screens.DemandForecastReports,
  inventory_forecast: Screens.InventoryForecast,
  customer_prediction: Screens.CustomerPrediction,
  attrition_prediction_reports: Screens.AttritionPredictionReports,
  fraud_detection_reports: Screens.FraudDetectionReports,
  custom_reports: Screens.CustomReports,
  saved_reports: Screens.SavedReports,
  scheduled_reports: Screens.ScheduledReports,
  exports: Screens.Exports,
};

function ReportsModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;

  let activeTab = "sales_reports";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "sales_reports";
  }

  const ActiveComponent =
    componentMap[activeTab] ||
    (() => (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="p-4 rounded-full bg-primary/10 text-primary">
          <Activity className="size-10" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Under Construction</h3>
        <p className="text-muted-foreground">The bespoke view for {activeTab} is still being assembled.</p>
      </div>
    ));

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <ComponentErrorBoundary componentName={activeTab}>
              <ActiveComponent />
            </ComponentErrorBoundary>
          </motion.div>
        </AnimatePresence>
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
