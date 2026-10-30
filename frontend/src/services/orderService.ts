/**
 * Unified Order Service & Microservice Facade.
 * Preserves the original orderService API and extends it with payments,
 * shared tables, and full restaurant workflow.
 *
 * Mapped to in-memory restaurantStore for local/offline fallback,
 * while re-exporting native-fetch microservice clients for online gateway access.
 */

// Native Fetch Microservice Clients
export { organizationService } from "./organizationService";
export { menuService } from "./menuService";
export { posService } from "./posService";
export { inventoryService } from "./inventoryService";
export { billingService } from "./billingService";
export { kitchenService } from "./kitchenService";
export {
  receiptTemplateService,
  useReceiptTemplate,
  useOrgReceiptTemplates,
  updateReceiptTemplate,
  resetReceiptTemplate,
  saveReceiptTemplateToBackend,
  syncReceiptTemplatesFromBackend,
  activateOrgReceiptTemplate,
  deleteOrgReceiptTemplate,
  DEFAULT_RECEIPT_TEMPLATE,
  type ReceiptTemplate,
  type SavedOrgReceiptTemplate,
} from "./receiptTemplateService";

// In-Memory Store & React State Facades
export {
  initRestaurantStore,
  resolveActiveOutletId,
  useOrders,
  useTables,
  useReservations,
  useMenu,
  useInventory,
  useCustomers,
  useStaff,
  useStaffShifts,
  usePayments,
  useSuppliers,
  usePurchaseOrders,
  useRecipes,
  useSettings,
  createOrder,
  setOrderStatus,
  settleOrder,
  recordPayment,
  setTableStatus,
  seatTable,
  addTable,
  updateTable,
  deleteTable,
  transferTable,
  reserveTable,
  toggleMenuItemAvailability,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  adjustStock,
  createPurchaseOrder,
  receivePurchaseOrder,
  autoGenerateCriticalPOs,
  addCustomer,
  awardPoints,
  createReservation,
  updateReservationStatus,
  seatReservation,
  updateStaffStatus,
  clockInStaff,
  clockOutStaff,
  addStaffMember,
  updateSettings,
  switchBranch,
  getLiveAiInsights,
} from "./restaurantStore";
