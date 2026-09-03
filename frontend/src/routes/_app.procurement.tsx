import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";

// Phase 1
import { Suppliers } from '../components/procurement/Suppliers';
import { SupplierCategories } from '../components/procurement/SupplierCategories';
import { SupplierContacts } from '../components/procurement/SupplierContacts';
import { SupplierContracts } from '../components/procurement/SupplierContracts';
import { SupplierPerformance } from '../components/procurement/SupplierPerformance';
import { SupplierRatings } from '../components/procurement/SupplierRatings';
import { BlacklistedSuppliers } from '../components/procurement/BlacklistedSuppliers';

// Phase 2
import { PurchaseRequests } from '../components/procurement/PurchaseRequests';
import { PurchaseQuotations } from '../components/procurement/PurchaseQuotations';
import { PurchaseOrders } from '../components/procurement/PurchaseOrders';
import { PurchaseApprovals } from '../components/procurement/PurchaseApprovals';
import { GoodsReceivedNotes } from '../components/procurement/GoodsReceivedNotes';
import { PurchaseReturns } from '../components/procurement/PurchaseReturns';

// Phase 3
import { VendorBills } from '../components/procurement/VendorBills';
import { PendingPayments } from '../components/procurement/PendingPayments';
import { PaymentHistory } from '../components/procurement/PaymentHistory';
import { CreditNotes } from '../components/procurement/CreditNotes';
import { DebitNotes } from '../components/procurement/DebitNotes';

// Phase 4
import { SpendAnalysis } from '../components/procurement/SpendAnalysis';
import { VendorAnalytics } from '../components/procurement/VendorAnalytics';
import { AIPurchaseSuggestions } from '../components/procurement/AIPurchaseSuggestions';
import { LeadTimeAnalysis } from '../components/procurement/LeadTimeAnalysis';
import { CostAnalysis } from '../components/procurement/CostAnalysis';
import { ProcurementForecast } from '../components/procurement/ProcurementForecast';

export const Route = createFileRoute('/_app/procurement')({
  component: ProcurementModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Phase 1
  suppliers: Suppliers,
  supplier_categories: SupplierCategories,
  supplier_contacts: SupplierContacts,
  supplier_contracts: SupplierContracts,
  supplier_performance: SupplierPerformance,
  supplier_ratings: SupplierRatings,
  blacklisted_suppliers: BlacklistedSuppliers,

  // Phase 2
  purchase_requests: PurchaseRequests,
  purchase_quotations: PurchaseQuotations,
  purchase_orders: PurchaseOrders,
  purchase_approvals: PurchaseApprovals,
  goods_received_notes: GoodsReceivedNotes,
  purchase_returns: PurchaseReturns,

  // Phase 3
  vendor_bills: VendorBills,
  pending_payments: PendingPayments,
  payment_history: PaymentHistory,
  credit_notes: CreditNotes,
  debit_notes: DebitNotes,

  // Phase 4
  spend_analysis: SpendAnalysis,
  vendor_analytics: VendorAnalytics,
  ai_purchase_suggestions: AIPurchaseSuggestions,
  lead_time_analysis: LeadTimeAnalysis,
  cost_analysis: CostAnalysis,
  procurement_forecast: ProcurementForecast,
};

function ProcurementModule() {
  const { hasPermission } = useRbac();
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  
  if (!hasPermission("view:procurement")) {
    return <Unauthorized />;
  }

  let activeTab = "suppliers";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "suppliers";
  }

  const ActiveComponent = componentMap[activeTab] || Suppliers;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50 p-3">
        <div className="w-full">
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
    </div>
  );
}
