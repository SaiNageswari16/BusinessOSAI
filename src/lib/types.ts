export type TableStatus = "available" | "occupied" | "reserved" | "billing" | "cleaning";
export type Area = "Main Hall" | "Terrace" | "Private Room";
export type OrderType = "dine-in" | "takeaway" | "delivery";
export type OrderStatus = "open" | "in-kitchen" | "ready" | "served" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type KotStatus = "new" | "accepted" | "preparing" | "ready" | "served";
export type Station = "Tandoor" | "Curry" | "Biryani" | "Desserts" | "Beverages";
export type ProfileId = "fine-dining" | "casual" | "qsr" | "cafe" | "cloud-kitchen";

export interface DiningTable {
  id: string;
  name: string;
  area: Area;
  capacity: number;
  status: TableStatus;
  guests: number;
  orderId?: string | undefined;
  since?: number | undefined;
  x: number;
  y: number;
  shape: "round" | "rect";
  scale?: number | undefined;
  rotation?: number | undefined;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  veg: boolean;
  bestseller: boolean;
  available: boolean;
  station: Station;
  description: string;
  recipe: { ingredientId: string; qty: number }[];
  jain?: boolean | undefined;
  glutenFree?: boolean | undefined;
  prepTimeMins?: number | undefined;
  servingSize?: string | undefined;
  itemType?: string | undefined;
  tags?: string[] | undefined;
  modifiers?: string[] | undefined;
  addons?: Addon[] | undefined;
}

export interface Addon {
  name: string;
  price: number;
}

export interface OrderLine {
  lineId: string;
  itemId: string;
  name: string;
  price: number;
  qty: number;
  modifiers: string[];
  addons: Addon[];
  note: string;
  station: Station;
}

export interface Order {
  id: string;
  type: OrderType;
  tableId?: string | undefined;
  customerId?: string | undefined;
  guests: number;
  lines: OrderLine[];
  discountPct: number;
  status: OrderStatus;
  payment: PaymentStatus;
  paymentMethod?: string | undefined;
  createdAt: number;
  paidAt?: number | undefined;
  stockDeducted: boolean;
  provider?: string | undefined;
  deliveryStage?: "packing" | "dispatched" | "delivered" | undefined;
  note?: string | undefined;
}

export interface Kot {
  id: string;
  orderId: string;
  station: Station;
  status: KotStatus;
  lines: OrderLine[];
  createdAt: number;
  startedAt?: number | undefined;
  readyAt?: number | undefined;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  tier: "Gold" | "Silver" | "Bronze";
  notes: string;
}

export interface Reservation {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  party: number;
  tableId?: string | undefined;
  status: "booked" | "confirmed" | "seated" | "completed" | "cancelled" | "waitlist";
  request: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  reorder: number;
  cost: number;
  supplierId: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  category: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  lines: { ingredientId: string; qty: number }[];
  status: "pending" | "received" | "cancelled";
  createdAt: number;
  receivedAt?: number | undefined;
}

export interface StockMove {
  id: string;
  ingredientId: string;
  qty: number;
  reason: "purchase" | "adjustment" | "wastage" | "consumption";
  ref: string;
  at: number;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  shift: "Morning" | "Evening" | "Night";
  present: boolean;
  phone: string;
  rating: number;
  assignment: string;
}

export interface Settings {
  restaurant: string;
  branch: string;
  gstPct: number;
  serviceChargePct: number;
  profile: ProfileId;
  dark: boolean;
  printKot: boolean;
  notifyLowStock: boolean;
  maxDiscountPct: number;
}

export interface Notice {
  id: string;
  text: string;
  at: number;
  read: boolean;
  tone: "info" | "warning" | "success";
}
