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
  stock_summary: () => <Screens.StockReports defaultReport="stock_summary" />,
  stock_detail: () => <Screens.StockReports defaultReport="stock_detail" />,
  stock_godown: () => <Screens.StockReports defaultReport="stock_godown" />,
  godown_stock: () => <Screens.StockReports defaultReport="stock_godown" />,
  item_batch: () => <Screens.StockReports defaultReport="item_batch" />,
  item_party: () => <Screens.StockReports defaultReport="item_party" />,
  item_sales_purchase_summary: () => <Screens.StockReports defaultReport="item_sales_purchase_summary" />,
  low_stock_summary: () => <Screens.StockReports defaultReport="low_stock_summary" />,
  rate_list: () => <Screens.StockReports defaultReport="rate_list" />,
  product_sales: () => <Screens.StockReports defaultReport="product_sales" />,
  product_profitability: () => <Screens.StockReports defaultReport="product_profitability" />,
  abc_analysis_reports: Screens.AbcAnalysisReports,
  xyz_analysis_reports: Screens.XyzAnalysisReports,

  // Procurement & Vendors
  purchase_reports: Screens.PurchaseReports,
  supplier_reports: Screens.SupplierReports,
  grn_reports: Screens.GrnReports,
  spend_analysis_reports: Screens.SpendAnalysisReports,

  // Customers & Party Reports
  customer_reports: Screens.CustomerReports,
  party_statement: () => <Screens.CustomerReports defaultReport="party_statement" />,
  party_outstanding: () => <Screens.CustomerReports defaultReport="party_outstanding" />,
  receivables_reports: () => <Screens.CustomerReports defaultReport="party_outstanding" />,
  payables_reports: () => <Screens.CustomerReports defaultReport="party_outstanding" />,
  party_ageing: () => <Screens.CustomerReports defaultReport="party_ageing" />,
  party_item_report: () => <Screens.CustomerReports defaultReport="party_item_report" />,
  customer_sales: () => <Screens.CustomerReports defaultReport="customer_sales" />,
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

  // Finance & Accounting & GST
  pnl_reports: Screens.PnlReports,
  profit_loss: Screens.PnlReports,
  balance_sheet_reports: Screens.BalanceSheetReports,
  balance_sheet: Screens.BalanceSheetReports,
  trial_balance: ReportsHub,
  voucher_register: ReportsHub,
  cost_centre_reports: ReportsHub,
  day_book: ReportsHub,
  cash_flow_reports: Screens.CashFlowReports,
  gst_reports: Screens.GstReports,
  expense_reports: Screens.ExpenseReports,

  // Dedicated GST Reports
  gst_gstr1: () => <Screens.GstReports defaultReport="gstr1" />,
  gst_gstr3b: () => <Screens.GstReports defaultReport="gstr3b" />,
  gst_gstr2b: () => <Screens.GstReports defaultReport="gstr2b" />,
  gst_sales: () => <Screens.GstReports defaultReport="gst_sales" />,
  gst_purchase: () => <Screens.GstReports defaultReport="gst_purchase" />,
  gst_gstr2_purchase: () => <Screens.GstReports defaultReport="gstr2_purchase" />,
  gst_tax_summary: () => <Screens.GstReports defaultReport="gst_tax_summary" />,
  gst_hsn_summary: () => <Screens.GstReports defaultReport="hsn_summary" />,
  gst_b2b: () => <Screens.GstReports defaultReport="b2b_sales" />,
  gst_b2c: () => <Screens.GstReports defaultReport="b2c_sales" />,
  gst_export: () => <Screens.GstReports defaultReport="export_sales" />,
  gst_cdnr: () => <Screens.GstReports defaultReport="cdnr_report" />,
  gst_rate_wise: () => <Screens.GstReports defaultReport="rate_wise" />,
  gst_gstin_wise: () => <Screens.GstReports defaultReport="gstin_wise" />,
  gst_pos: () => <Screens.GstReports defaultReport="place_of_supply" />,
  gst_itc: () => <Screens.GstReports defaultReport="itc_report" />,
  gst_output_liability: () => <Screens.GstReports defaultReport="output_liability" />,
  gst_reconciliation: () => <Screens.GstReports defaultReport="reconciliation" />,
  tds_payable: () => <Screens.GstReports defaultReport="tds_payable" />,
  tds_receivable: () => <Screens.GstReports defaultReport="tds_receivable" />,
  tcs_payable: () => <Screens.GstReports defaultReport="tcs_payable" />,
  tcs_receivable: () => <Screens.GstReports defaultReport="tcs_receivable" />,

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
    <div className="flex h-[calc(100vh-3.75rem)] flex-col bg-background overflow-hidden">
      <div className="flex-1 relative bg-background/50 p-0 overflow-hidden h-full">
        <div key={activeTab} className="h-full w-full overflow-hidden">
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
