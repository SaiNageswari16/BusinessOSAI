// Domain types shared by mock data and (later) FastAPI responses.
export type OrderType = "Dine-in" | "Takeaway" | "Delivery" | "Online";
export type OrderStatus = "New" | "Preparing" | "Ready" | "Served" | "Completed" | "Cancelled";
export type TableStatus = "Available" | "Occupied" | "Reserved" | "Cleaning" | "Billing";
export type KitchenStation = "Tandoor" | "Main" | "Biryani" | "Beverages" | "Desserts";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  prepMins: number;
  veg: boolean;
  available: boolean;
  station: KitchenStation;
  popular?: boolean;
  costPct: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  options: { id: string; name: string; price: number }[];
}

export interface OrderLine {
  id: string;
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  modifiers: string[];
  note?: string;
  station: KitchenStation;
}

export interface Order {
  id: string;
  backendId?: string;
  backendKotId?: string;
  backendBillId?: string;
  billNumber?: string;
  type: OrderType;
  status: OrderStatus;
  table?: string;
  customer: string;
  phone?: string;
  lines: OrderLine[];
  createdAt: number; // epoch ms
  waiter: string;
  paid: boolean;
}

export type TableShape = "round" | "square" | "rectangle" | "l_shape" | "bar_counter";

export interface RestaurantTable {
  id: string;
  backendId?: string;
  name?: string;
  code?: string;
  area: string;
  seats: number;
  shape?: TableShape;
  status: TableStatus;
  guests?: number;
  orderId?: string;
  seatedMins?: number;
  waiter?: string;
  customerName?: string;
  customerPhone?: string;
  posX?: number;
  posY?: number;
  minCovers?: number;
  maxCovers?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  visits: number;
  spend: number;
  lastVisit: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  points: number;
  favourite: string;
  tags: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  par: number;
  costPerUnit: number;
  supplier: string;
  daysLeft: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  shift: string;
  status: "On shift" | "Break" | "Off" | "Leave";
  phone: string;
  rating: number;
  hoursWeek: number;
}

export interface Reservation {
  id: string;
  name: string;
  phone: string;
  guests: number;
  time: string;
  date: string;
  table?: string;
  status: "Confirmed" | "Pending" | "Seated" | "Cancelled" | "No-show";
  occasion?: string;
  notes?: string;
}

export type PaymentMethod = "Cash" | "UPI" | "Card" | "Wallet";

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  timestamp: number;
  customer: string;
  table?: string;
  transactionRef?: string;
}

export interface RecipeIngredient {
  inventoryId: string;
  name: string;
  qty: number;
  unit: string;
}

export interface Recipe {
  itemId: string;
  itemName: string;
  ingredients: RecipeIngredient[];
  cost: number;
  prepInstructions?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  deliveryDays: string[];
}

export interface PurchaseOrderItem {
  inventoryId: string;
  name: string;
  qty: number;
  unit: string;
  costPerUnit: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  status: "Draft" | "Sent" | "Received" | "Cancelled";
  items: PurchaseOrderItem[];
  total: number;
  createdAt: number;
  receivedAt?: number;
}

export interface StaffShift {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  date: string;
  shift: string;
  clockIn?: string;
  clockOut?: string;
  status: "Scheduled" | "On shift" | "Completed" | "Absent";
}

export interface RestaurantSettings {
  name: string;
  tagline: string;
  currentBranch: string;
  branches: string[];
  manager: string;
  register: string;
  gstin: string;
  fssai: string;
  phone: string;
  email: string;
  address: string;
  taxRate: number;
  serviceCharge: number;
  currencySymbol: string;
  autoPrintKOT: boolean;
  soundAlerts: boolean;
}
