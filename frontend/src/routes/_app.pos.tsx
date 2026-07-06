import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';

// Phase 1
import { POSTerminal } from '../components/pos/POSTerminal';
import { ShiftManagement } from '../components/pos/ShiftManagement';
import { SalesHistory } from '../components/pos/SalesHistory';
import { ReturnsRefunds } from '../components/pos/ReturnsRefunds';

// Phase 2
import { PosCustomers } from '../components/pos/PosCustomers';
import { LoyaltyPrograms } from '../components/pos/LoyaltyPrograms';

// Phase 3
import { StoreSettings } from '../components/pos/StoreSettings';
import { PaymentMethods } from '../components/pos/PaymentMethods';
import { ReceiptTemplates } from '../components/pos/ReceiptTemplates';

export const Route = createFileRoute('/_app/pos')({
  component: PosModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Phase 1
  terminal: POSTerminal,
  shift_management: ShiftManagement,
  sales_history: SalesHistory,
  returns_refunds: ReturnsRefunds,

  // Phase 2
  customers: PosCustomers,
  loyalty_programs: LoyaltyPrograms,

  // Phase 3
  store_settings: StoreSettings,
  payment_methods: PaymentMethods,
  receipt_templates: ReceiptTemplates,
};

function PosModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;

  let activeTab = "terminal";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "terminal";
  }

  const ActiveComponent = componentMap[activeTab] || POSTerminal;

  // The POS Terminal might want to be full screen, so we conditionally hide the padding
  const isTerminal = activeTab === "terminal";

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className={`flex-1 relative bg-background/50 ${isTerminal ? 'p-0' : 'p-6'}`}>
        <div className={isTerminal ? 'w-full h-full' : 'w-full px-6 py-6'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-full h-full"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
