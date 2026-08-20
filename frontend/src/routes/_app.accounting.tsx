import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MockScreen } from "@/components/mock-screen";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";

// Smart multi-view components
import { FinanceDashboard } from "@/components/accounting/FinanceDashboard";
import { AccountingCore } from "@/components/accounting/AccountingCore";
import { Receivables } from "@/components/accounting/Receivables";
import { Payables } from "@/components/accounting/Payables";
import { BankAccounts } from "@/components/accounting/BankAccounts";
import { TaxManagement } from "@/components/accounting/TaxManagement";
import { FixedAssets } from "@/components/accounting/FixedAssets";
import { ExpenseClaims } from "@/components/accounting/ExpenseClaims";
import { Budgets } from "@/components/accounting/Budgets";
import { ProfitAndLoss } from "@/components/accounting/ProfitAndLoss";
import { BalanceSheet } from "@/components/accounting/BalanceSheet";
import { GstFilingDashboard } from "@/components/accounting/GstFilingDashboard";

export const Route = createFileRoute("/_app/accounting")({
  component: AccountingModule,
});

// Map: tab key → which smart component to render (receives tab prop)
const componentMap: Record<string, React.ElementType> = {
  // Finance Dashboard (5 distinct sub-views inside FinanceDashboard)
  overview:             FinanceDashboard,
  cash_flow:            FinanceDashboard,
  revenue:              FinanceDashboard,
  expenses:             FinanceDashboard,
  profit:               FinanceDashboard,

  // Accounting Core (5 distinct sub-views inside AccountingCore)
  chart_of_accounts:    AccountingCore,
  general_ledger:       AccountingCore,
  journal_entries:      AccountingCore,
  opening_balances:     AccountingCore,
  closing_entries:      AccountingCore,

  // Receivables (5 distinct sub-views inside Receivables)
  customers:            Receivables,
  invoices:             Receivables,
  payments:             Receivables,
  outstanding:          Receivables,
  collections:          Receivables,

  // Payables (5 distinct sub-views inside Payables)
  vendor_bills:         Payables,
  payments_made:        Payables,
  credit_notes:         Payables,
  debit_notes:          Payables,
  vendor_aging:         Payables,

  // Banking (unique component per tab)
  bank_accounts:        BankAccounts,
  cash_accounts:        BankAccounts,
  reconciliation:       BankAccounts,
  bank_statements:      BankAccounts,

  // Taxes & GST Returns (Whitebooks GSP Compliant)
  gst:                  GstFilingDashboard,
  gst_returns:          GstFilingDashboard,
  tax_filing:           GstFilingDashboard,
  tds:                  TaxManagement,
  vat:                  TaxManagement,
  tax_rules:            TaxManagement,

  // Fixed Assets
  fixed_assets:         FixedAssets,
  asset_categories:     FixedAssets,
  depreciation:         FixedAssets,
  asset_register:       FixedAssets,

  // Budgeting
  budgets:              Budgets,
  forecasts:            Budgets,
  cost_allocation:      Budgets,
  financial_planning:   Budgets,

  // Expenses
  expense_claims:       ExpenseClaims,
  approvals:            ExpenseClaims,
  travel:               ExpenseClaims,
  office_expenses:      ExpenseClaims,
  operational_expenses: ExpenseClaims,

  // Financial Statements
  profit_and_loss:      ProfitAndLoss,
  balance_sheet:        BalanceSheet,
  trial_balance:        ProfitAndLoss,
  cash_flow_statement:  FinanceDashboard,
  gl_statement:         AccountingCore,

  // Financial Intelligence
  revenue_analytics:    FinanceDashboard,
  expense_analytics:    FinanceDashboard,
  profit_forecast:      ProfitAndLoss,
  cash_forecast:        FinanceDashboard,
  ai_financial_insights: FinanceDashboard,
};

function AccountingModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  const { hasPermission } = useRbac();
  
  if (!hasPermission("view:accounting")) {
    return <Unauthorized />;
  }

  let activeTab = "overview";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "overview";
  }

  const formatTitle = (str: string) =>
    str.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const ActiveComponent = componentMap[activeTab] || (() => <MockScreen type="accounting" title={formatTitle(activeTab)} />);

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
            {/* Pass the active tab down so smart components can render unique content */}
            <ActiveComponent tab={activeTab} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
