import { create } from "zustand";
import { clampQty, deriveOrderStatusFromKots, totals, validDiscount } from "./calc";
import { buildSeed, type HeldCart } from "./seed";
import type {
  Addon,
  Area,
  Customer,
  DiningTable,
  Ingredient,
  Kot,
  KotStatus,
  MenuItem,
  Notice,
  Order,
  OrderLine,
  OrderStatus,
  OrderType,
  ProfileId,
  PurchaseOrder,
  Reservation,
  Settings,
  Staff,
  Station,
  StockMove,
  Supplier,
  TableStatus,
} from "./types";

export interface ComboItem {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  price: number;
  regularPrice: number;
  veg: boolean;
  available: boolean;
  category: string;
}

export interface PosDraft {
  orderType: OrderType;
  tableId?: string | undefined;
  customerId?: string | undefined;
  guests: number;
  lines: OrderLine[];
  discountPct: number;
  editingOrderId?: string | undefined;
  provider?: string | undefined;
  note: string;
}

export const BRANCHES = [
  "Hyderabad Central",
  "Banjara Hills",
  "Jubilee Hills",
  "HITEC City",
] as const;

const INITIAL_COMBOS: ComboItem[] = [
  {
    id: "CMB-1",
    name: "Royal Nizami Biryani Feast",
    description: "Hyderabadi Chicken Dum Biryani + Chicken 65 + Double ka Meetha + 2 Masala Chai",
    itemIds: ["M22", "M2", "M34", "M38"],
    price: 820,
    regularPrice: 960,
    veg: false,
    available: true,
    category: "Biryani",
  },
  {
    id: "CMB-2",
    name: "Veg Nawabi Family Combo",
    description: "Paneer Tikka + Paneer Butter Masala + Dal Makhani + 2 Butter Naan + Gulab Jamun",
    itemIds: ["M1", "M15", "M16", "M28", "M33"],
    price: 990,
    regularPrice: 1240,
    veg: true,
    available: true,
    category: "Curries",
  },
  {
    id: "CMB-3",
    name: "Charminar Tandoori Platter",
    description: "Chicken Tikka + Malai Kebab + Seekh Kebab + 2 Garlic Naan + Mint Mojito",
    itemIds: ["M8", "M10", "M11", "M29", "M43"],
    price: 1290,
    regularPrice: 1560,
    veg: false,
    available: true,
    category: "Tandoor",
  },
  {
    id: "CMB-4",
    name: "Irani Cafe Chai & Osmania Duo",
    description: "2 Masala Chai + Hara Bhara Kebab + Double ka Meetha",
    itemIds: ["M38", "M7", "M34"],
    price: 440,
    regularPrice: 560,
    veg: true,
    available: true,
    category: "Beverages",
  },
  {
    id: "CMB-5",
    name: "Deccan Corporate Lunch Thali",
    description: "Butter Chicken + Dal Tadka + 2 Garlic Naan + Gulab Jamun + Fresh Lime Soda",
    itemIds: ["M14", "M20", "M29", "M33", "M40"],
    price: 580,
    regularPrice: 710,
    veg: false,
    available: true,
    category: "Curries",
  },
  {
    id: "CMB-6",
    name: "Indo-Chinese Wok Feast",
    description: "Veg Manchurian + Chilli Chicken + Paneer 65 + 2 Fresh Lime Soda",
    itemIds: ["M4", "M2", "M5", "M40"],
    price: 760,
    regularPrice: 940,
    veg: false,
    available: true,
    category: "Starters",
  },
  {
    id: "CMB-7",
    name: "South Indian Breakfast Duo",
    description: "2 Masala Dosa + Filter Coffee + Masala Chai",
    itemIds: ["M32", "M41", "M38"],
    price: 410,
    regularPrice: 500,
    veg: true,
    available: true,
    category: "Breads",
  },
  {
    id: "CMB-8",
    name: "Shahi Dessert & Lassi Box",
    description: "Qubani ka Meetha + Rasmalai + Kulfi Falooda + 2 Mango Lassi",
    itemIds: ["M35", "M36", "M37", "M39"],
    price: 720,
    regularPrice: 880,
    veg: true,
    available: true,
    category: "Desserts",
  },
];

const STORAGE_KEY = "restaurantos_shared_state_v4";

function createDefaultPosDraft(seed?: ReturnType<typeof buildSeed>): PosDraft {
  const t2Order = seed?.orders.find(
    (o) => o.tableId === "T2" && o.payment === "unpaid" && o.status !== "cancelled",
  );
  if (t2Order) {
    return {
      orderType: "dine-in",
      tableId: "T2",
      customerId: t2Order.customerId ?? "C1",
      guests: t2Order.guests || 3,
      lines: t2Order.lines.map((l) => ({ ...l })),
      discountPct: t2Order.discountPct,
      editingOrderId: t2Order.id,
      provider: undefined,
      note: "",
    };
  }
  return {
    orderType: "dine-in",
    tableId: "T2",
    customerId: "C1",
    guests: 3,
    lines: [],
    discountPct: 10,
    editingOrderId: undefined,
    provider: undefined,
    note: "",
  };
}

export interface RestaurantState {
  tables: DiningTable[];
  menu: MenuItem[];
  combos: ComboItem[];
  orders: Order[];
  kots: Kot[];
  customers: Customer[];
  reservations: Reservation[];
  ingredients: Ingredient[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  stockMoves: StockMove[];
  staff: Staff[];
  settings: Settings;
  notices: Notice[];
  seq: { order: number; kot: number; po: number; res: number };
  held: HeldCart[];
  posDraft: PosDraft;

  // POS & Cart actions
  openPosForTable: (tableId: string) => void;
  openPosForOrder: (orderId: string) => void;
  setPosOrderType: (orderType: OrderType) => void;
  setPosTable: (tableId?: string) => void;
  setPosCustomer: (customerId?: string) => void;
  setPosGuests: (guests: number) => void;
  setPosDiscount: (discountPct: number) => boolean;
  setPosProvider: (provider?: string) => void;
  setPosNote: (note: string) => void;
  addToPosCart: (
    item: MenuItem,
    qty?: number,
    modifiers?: string[],
    addons?: Addon[],
    note?: string,
  ) => { ok: boolean; error?: string };
  addComboToPosCart: (combo: ComboItem) => { ok: boolean; error?: string };
  addCustomItemToPosCart: (input: {
    name: string;
    price: number;
    qty?: number;
    veg?: boolean;
    station?: Station;
    category?: string;
    note?: string;
    saveToMenu?: boolean;
  }) => { ok: boolean; lineId?: string; error?: string };
  updatePosLineQty: (lineId: string, qty: number) => void;
  updatePosLineDetails: (
    lineId: string,
    patch: Partial<Pick<OrderLine, "modifiers" | "addons" | "note">>,
  ) => void;
  removePosLine: (lineId: string) => void;
  clearPosCart: () => void;
  holdPosOrder: (label?: string) => { ok: boolean; heldId?: string; error?: string };
  resumeHeldOrder: (heldId: string) => void;
  deleteHeldOrder: (heldId: string) => void;
  submitPosOrder: () => { ok: boolean; orderId?: string; kotIds?: string[]; error?: string };

  // Order & Billing actions
  requestBill: (orderId: string) => void;
  updateOrderDiscount: (orderId: string, discountPct: number) => { ok: boolean; error?: string };
  updateOrderNote: (orderId: string, note: string) => void;
  sendOrderToKitchen: (orderId: string) => {
    ok: boolean;
    kotIds?: string[];
    error?: string;
  };
  holdExistingOrder: (orderId: string) => {
    ok: boolean;
    heldId?: string;
    error?: string;
  };
  completePayment: (
    orderId: string,
    paymentMethod: string,
    discountPct?: number,
    nextTableStatus?: "available" | "cleaning",
  ) => { ok: boolean; error?: string };
  cancelOrder: (orderId: string, reason?: string) => { ok: boolean; error?: string };

  // Table & Floor operations
  setTableStatus: (tableId: string, status: TableStatus, guests?: number) => void;
  transferTable: (fromTableId: string, toTableId: string) => { ok: boolean; error?: string };
  mergeTables: (
    primaryTableId: string,
    secondaryTableId: string,
  ) => { ok: boolean; error?: string };
  splitTableBill: (
    orderId: string,
    lineIdsToSplit: string[],
  ) => { ok: boolean; newOrderId?: string; error?: string };
  saveTablesLayout: (tables: DiningTable[]) => void;
  addDiningTable: (input: {
    id?: string;
    name: string;
    area: Area;
    capacity: number;
    shape: "round" | "rect";
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
  }) => { ok: boolean; table?: DiningTable; error?: string };
  updateDiningTable: (
    tableId: string,
    patch: Partial<
      Pick<DiningTable, "name" | "area" | "capacity" | "shape" | "x" | "y" | "scale" | "rotation">
    >,
  ) => { ok: boolean; error?: string };
  deleteDiningTable: (tableId: string) => { ok: boolean; error?: string };

  // KOT & KDS actions
  updateKotStatus: (kotId: string, status: KotStatus) => void;
  advanceKot: (kotId: string) => void;
  markOrderServed: (orderId: string) => void;

  // Menu actions
  toggleMenuAvailability: (itemId: string) => void;
  updateMenuPrice: (itemId: string, price: number) => void;
  saveMenuItem: (item: Omit<MenuItem, "id"> & { id?: string }) => string;
  duplicateMenuItem: (itemId: string) => { ok: boolean; newItem?: MenuItem; error?: string };
  deleteMenuItem: (itemId: string) => { ok: boolean; error?: string };
  toggleComboAvailability: (comboId: string) => void;
  saveCombo: (combo: Omit<ComboItem, "id"> & { id?: string }) => string;

  // Inventory & Purchasing actions
  createPurchaseOrder: (
    supplierId: string,
    lines: { ingredientId: string; qty: number }[],
  ) => { ok: boolean; poId?: string; error?: string };
  receivePurchaseOrder: (poId: string) => { ok: boolean; error?: string };
  cancelPurchaseOrder: (poId: string) => void;
  adjustIngredientStock: (
    ingredientId: string,
    deltaQty: number,
    reason: StockMove["reason"],
    ref: string,
  ) => void;
  saveIngredient: (ing: Omit<Ingredient, "id"> & { id?: string }) => string;
  saveSupplier: (sup: Omit<Supplier, "id"> & { id?: string }) => string;

  // Reservations actions
  createReservation: (res: Omit<Reservation, "id">) => string;
  updateReservationStatus: (resId: string, status: Reservation["status"], tableId?: string) => void;
  assignReservationTable: (resId: string, tableId?: string) => void;

  // CRM actions
  saveCustomer: (cust: Omit<Customer, "id"> & { id?: string }) => string;
  adjustCustomerPoints: (customerId: string, delta: number) => void;

  // Staff actions
  toggleStaffPresent: (staffId: string) => void;
  updateStaffMember: (staffId: string, patch: Partial<Staff>) => void;
  addStaffMember: (member: Omit<Staff, "id">) => string;

  // Delivery actions
  advanceDeliveryOrder: (orderId: string) => void;
  updateDeliveryProvider: (orderId: string, provider: string) => void;

  // Settings, Profile, Notifications & Reset
  updateSettings: (patch: Partial<Settings>) => void;
  setProfile: (profile: ProfileId) => void;
  setBranch: (branch: string) => void;
  toggleDark: () => void;
  addNotice: (text: string, tone?: Notice["tone"]) => void;
  markNoticeRead: (id: string) => void;
  markAllNoticesRead: () => void;
  resetDemoData: () => void;
}

type PersistedSlice = Pick<
  RestaurantState,
  | "tables"
  | "menu"
  | "combos"
  | "orders"
  | "kots"
  | "customers"
  | "reservations"
  | "ingredients"
  | "suppliers"
  | "purchaseOrders"
  | "stockMoves"
  | "staff"
  | "settings"
  | "notices"
  | "seq"
  | "held"
  | "posDraft"
>;

function getInitialData(): PersistedSlice {
  const seed = buildSeed();
  const base: PersistedSlice = {
    ...seed,
    combos: INITIAL_COMBOS.map((c) => ({ ...c })),
    posDraft: createDefaultPosDraft(seed),
  };
  if (typeof window === "undefined") {
    return base;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PersistedSlice>;
    if (!parsed.tables || !parsed.menu || !parsed.orders || !parsed.settings) {
      return base;
    }
    return {
      ...base,
      ...parsed,
      combos: parsed.combos ?? base.combos,
      posDraft: parsed.posDraft ?? base.posDraft,
    };
  } catch {
    return base;
  }
}

function persistState(state: RestaurantState) {
  if (typeof window === "undefined") return;
  try {
    const slice: PersistedSlice = {
      tables: state.tables,
      menu: state.menu,
      combos: state.combos,
      orders: state.orders,
      kots: state.kots,
      customers: state.customers,
      reservations: state.reservations,
      ingredients: state.ingredients,
      suppliers: state.suppliers,
      purchaseOrders: state.purchaseOrders,
      stockMoves: state.stockMoves,
      staff: state.staff,
      settings: state.settings,
      notices: state.notices,
      seq: state.seq,
      held: state.held,
      posDraft: state.posDraft,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
  } catch {
    // Ignore storage quota errors in demo mode
  }
}

function deductOrderIngredients(
  lines: OrderLine[],
  menu: MenuItem[],
  ingredients: Ingredient[],
  stockMoves: StockMove[],
  orderId: string,
  now: number,
  notifyLowStock: boolean,
  notices: Notice[],
) {
  const updatedIngredients = ingredients.map((ing) => ({ ...ing }));
  const newMoves = [...stockMoves];
  const newNotices = [...notices];

  for (const line of lines) {
    const menuItem = menu.find((m) => m.id === line.itemId);
    if (!menuItem) continue;
    for (const r of menuItem.recipe) {
      const target = updatedIngredients.find((i) => i.id === r.ingredientId);
      if (!target) continue;
      const consumed = Math.round(r.qty * line.qty * 1000) / 1000;
      const prevStock = target.stock;
      target.stock = Math.max(0, Math.round((target.stock - consumed) * 1000) / 1000);
      newMoves.unshift({
        id: `SM-${now}-${Math.random().toString(36).slice(2, 6)}`,
        ingredientId: target.id,
        qty: -consumed,
        reason: "consumption",
        ref: orderId,
        at: now,
      });
      if (notifyLowStock && prevStock > target.reorder && target.stock <= target.reorder) {
        newNotices.unshift({
          id: `N-${now}-${target.id}`,
          text: `${target.name} dropped to low stock (${target.stock} ${target.unit} left)`,
          at: now,
          read: false,
          tone: "warning",
        });
      }
    }
  }

  return { updatedIngredients, newMoves, newNotices };
}

export const useRestaurantStore = create<RestaurantState>((set, get) => {
  const initial = getInitialData();

  const updateAndPersist = (updater: (state: RestaurantState) => Partial<RestaurantState>) => {
    set((state) => {
      const patch = updater(state);
      const next = { ...state, ...patch };
      persistState(next);
      return patch;
    });
  };

  return {
    ...initial,

    openPosForTable: (tableId) => {
      updateAndPersist((state) => {
        const tbl = state.tables.find((t) => t.id === tableId);
        const existingOrder = tbl?.orderId
          ? state.orders.find((o) => o.id === tbl.orderId && o.payment === "unpaid")
          : state.orders.find(
              (o) =>
                o.tableId === tableId &&
                o.payment === "unpaid" &&
                o.status !== "cancelled" &&
                o.status !== "completed",
            );

        if (existingOrder) {
          return {
            posDraft: {
              orderType: "dine-in",
              tableId,
              customerId: existingOrder.customerId,
              guests: existingOrder.guests || tbl?.guests || 2,
              lines: existingOrder.lines.map((l) => ({ ...l })),
              discountPct: existingOrder.discountPct,
              editingOrderId: existingOrder.id,
              provider: undefined,
              note: "",
            },
          };
        }

        return {
          posDraft: {
            orderType: "dine-in",
            tableId,
            customerId: undefined,
            guests: tbl?.guests || Math.min(tbl?.capacity ?? 4, 2),
            lines: [],
            discountPct: 0,
            editingOrderId: undefined,
            provider: undefined,
            note: "",
          },
        };
      });
    },

    openPosForOrder: (orderId) => {
      updateAndPersist((state) => {
        const ord = state.orders.find((o) => o.id === orderId);
        if (!ord) return {};
        return {
          posDraft: {
            orderType: ord.type,
            tableId: ord.tableId,
            customerId: ord.customerId,
            guests: ord.guests,
            lines: ord.lines.map((l) => ({ ...l })),
            discountPct: ord.discountPct,
            editingOrderId: ord.id,
            provider: ord.provider,
            note: "",
          },
        };
      });
    },

    setPosOrderType: (orderType) => {
      updateAndPersist((state) => ({
        posDraft: {
          ...state.posDraft,
          orderType,
          tableId:
            orderType === "dine-in" ? (state.posDraft.tableId ?? state.tables[0]?.id) : undefined,
          provider: orderType === "delivery" ? (state.posDraft.provider ?? "Own fleet") : undefined,
        },
      }));
    },

    setPosTable: (tableId) => {
      if (!tableId) {
        updateAndPersist((state) => ({
          posDraft: { ...state.posDraft, tableId: undefined, editingOrderId: undefined },
        }));
        return;
      }
      get().openPosForTable(tableId);
    },

    setPosCustomer: (customerId) => {
      updateAndPersist((state) => ({
        posDraft: { ...state.posDraft, customerId },
      }));
    },

    setPosGuests: (guests) => {
      updateAndPersist((state) => ({
        posDraft: { ...state.posDraft, guests: Math.max(1, Math.min(24, Math.floor(guests))) },
      }));
    },

    setPosDiscount: (discountPct) => {
      const max = get().settings.maxDiscountPct;
      if (!validDiscount(discountPct, max)) {
        return false;
      }
      updateAndPersist((state) => ({
        posDraft: { ...state.posDraft, discountPct },
      }));
      return true;
    },

    setPosProvider: (provider) => {
      updateAndPersist((state) => ({
        posDraft: { ...state.posDraft, provider },
      }));
    },

    setPosNote: (note) => {
      updateAndPersist((state) => ({
        posDraft: { ...state.posDraft, note },
      }));
    },

    addToPosCart: (item, qty = 1, modifiers = [], addons = [], note = "") => {
      const currentMenu = get().menu.find((m) => m.id === item.id);
      if (currentMenu && !currentMenu.available) {
        return { ok: false, error: `${item.name} is currently marked unavailable.` };
      }
      const safeQty = clampQty(qty);
      const modKey = [...modifiers].sort().join("|");
      const addonKey = [...addons]
        .map((a) => `${a.name}:${a.price}`)
        .sort()
        .join("|");

      updateAndPersist((state) => {
        const existingIdx = state.posDraft.lines.findIndex((l) => {
          const lMod = [...l.modifiers].sort().join("|");
          const lAdd = [...l.addons]
            .map((a) => `${a.name}:${a.price}`)
            .sort()
            .join("|");
          return (
            l.itemId === item.id &&
            lMod === modKey &&
            lAdd === addonKey &&
            l.note.trim() === note.trim()
          );
        });

        const nextLines = [...state.posDraft.lines];
        if (existingIdx >= 0) {
          const prev = nextLines[existingIdx]!;
          nextLines[existingIdx] = {
            ...prev,
            qty: clampQty(prev.qty + safeQty),
          };
        } else {
          nextLines.push({
            lineId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: item.id,
            name: item.name,
            price: item.price,
            qty: safeQty,
            modifiers: [...modifiers],
            addons: [...addons],
            note: note.trim(),
            station: item.station,
          });
        }

        return {
          posDraft: {
            ...state.posDraft,
            lines: nextLines,
          },
        };
      });

      return { ok: true };
    },

    addComboToPosCart: (combo) => {
      if (!combo.available) {
        return { ok: false, error: `${combo.name} is currently unavailable.` };
      }
      const state = get();
      const firstItem = state.menu.find((m) => combo.itemIds.includes(m.id));
      const station: Station = firstItem?.station ?? "Curry";

      updateAndPersist((s) => ({
        posDraft: {
          ...s.posDraft,
          lines: [
            ...s.posDraft.lines,
            {
              lineId: `L-CMB-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              itemId: combo.itemIds[0] ?? "M1",
              name: `${combo.name} (Combo)`,
              price: combo.price,
              qty: 1,
              modifiers: [],
              addons: [],
              note: combo.description,
              station,
            },
          ],
        },
      }));
      return { ok: true };
    },

    addCustomItemToPosCart: (input) => {
      const cleanName = input.name.trim();
      if (!cleanName) {
        return { ok: false, error: "Custom item name is required." };
      }
      const numericPrice = Number(input.price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return { ok: false, error: "Price must be greater than ₹0." };
      }
      const rawQty = input.qty ?? 1;
      if (!Number.isFinite(rawQty) || rawQty < 1 || rawQty > 99) {
        return { ok: false, error: "Quantity must be between 1 and 99." };
      }
      const safeQty = clampQty(rawQty);
      const station: Station = input.station ?? "Curry";
      const lineId = `L-CUST-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

      let customMenuItemId = `CUSTOM-${Date.now()}`;
      if (input.saveToMenu) {
        customMenuItemId = get().saveMenuItem({
          name: cleanName,
          category: input.category?.trim() || "Starters",
          price: Math.round(numericPrice),
          veg: input.veg ?? true,
          bestseller: false,
          available: true,
          station,
          description: input.note?.trim() || "Custom kitchen item",
          recipe: [],
        });
      }

      updateAndPersist((s) => ({
        posDraft: {
          ...s.posDraft,
          lines: [
            ...s.posDraft.lines,
            {
              lineId,
              itemId: customMenuItemId,
              name: cleanName,
              price: Math.round(numericPrice),
              qty: safeQty,
              modifiers: input.veg === false ? ["Non-Veg Custom"] : [],
              addons: [],
              note: input.note?.trim() ?? "",
              station,
            },
          ],
        },
      }));

      return { ok: true, lineId };
    },

    updatePosLineQty: (lineId, qty) => {
      if (qty <= 0) {
        get().removePosLine(lineId);
        return;
      }
      const safe = clampQty(qty);
      updateAndPersist((state) => ({
        posDraft: {
          ...state.posDraft,
          lines: state.posDraft.lines.map((l) => (l.lineId === lineId ? { ...l, qty: safe } : l)),
        },
      }));
    },

    updatePosLineDetails: (lineId, patch) => {
      updateAndPersist((state) => ({
        posDraft: {
          ...state.posDraft,
          lines: state.posDraft.lines.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)),
        },
      }));
    },

    removePosLine: (lineId) => {
      updateAndPersist((state) => ({
        posDraft: {
          ...state.posDraft,
          lines: state.posDraft.lines.filter((l) => l.lineId !== lineId),
        },
      }));
    },

    clearPosCart: () => {
      updateAndPersist((state) => ({
        posDraft: {
          ...state.posDraft,
          lines: [],
          discountPct: 0,
          editingOrderId: undefined,
          note: "",
        },
      }));
    },

    holdPosOrder: (label) => {
      const { posDraft } = get();
      if (posDraft.lines.length === 0) {
        return { ok: false, error: "Add at least one item before holding the order." };
      }
      const now = Date.now();
      const heldId = `HOLD-${now.toString().slice(-4)}`;
      const entry: HeldCart = {
        id: heldId,
        label:
          label?.trim() ||
          (posDraft.tableId ? `Table ${posDraft.tableId}` : `${posDraft.orderType.toUpperCase()}`),
        tableId: posDraft.tableId,
        lines: posDraft.lines.map((l) => ({ ...l })),
        at: now,
      };
      updateAndPersist((state) => ({
        held: [entry, ...state.held],
        posDraft: {
          ...state.posDraft,
          lines: [],
          discountPct: 0,
          editingOrderId: undefined,
          note: "",
        },
      }));
      return { ok: true, heldId };
    },

    resumeHeldOrder: (heldId) => {
      updateAndPersist((state) => {
        const target = state.held.find((h) => h.id === heldId);
        if (!target) return {};
        return {
          held: state.held.filter((h) => h.id !== heldId),
          posDraft: {
            ...state.posDraft,
            tableId: target.tableId ?? state.posDraft.tableId,
            orderType: target.tableId ? "dine-in" : state.posDraft.orderType,
            lines: target.lines.map((l) => ({ ...l })),
          },
        };
      });
    },

    deleteHeldOrder: (heldId) => {
      updateAndPersist((state) => ({
        held: state.held.filter((h) => h.id !== heldId),
      }));
    },

    submitPosOrder: () => {
      const state = get();
      const { posDraft } = state;
      if (posDraft.lines.length === 0) {
        return { ok: false, error: "Cart is empty. Add menu items before sending to kitchen." };
      }
      if (posDraft.orderType === "dine-in" && !posDraft.tableId) {
        return { ok: false, error: "Select a table for dine-in orders." };
      }
      if (!validDiscount(posDraft.discountPct, state.settings.maxDiscountPct)) {
        return {
          ok: false,
          error: `Discount must be between 0% and ${state.settings.maxDiscountPct}%.`,
        };
      }

      const now = Date.now();
      let resultOrderId = "";
      const createdKotIds: string[] = [];

      updateAndPersist((s) => {
        // Check if editing an existing order OR if the selected dine-in table already has an active unpaid order
        const existingOrder =
          (posDraft.editingOrderId
            ? s.orders.find((o) => o.id === posDraft.editingOrderId)
            : undefined) ??
          (posDraft.orderType === "dine-in" && posDraft.tableId
            ? s.orders.find(
                (o) =>
                  o.tableId === posDraft.tableId &&
                  o.payment === "unpaid" &&
                  o.status !== "completed" &&
                  o.status !== "cancelled",
              )
            : undefined);

        let nextOrderSeq = s.seq.order;
        let nextKotSeq = s.seq.kot;
        const orderId = existingOrder ? existingOrder.id : `ORD-${nextOrderSeq++}`;
        resultOrderId = orderId;

        // Determine which lines are newly added (to avoid duplicate KOTs and duplicate stock deduction)
        const previousLineIds = new Set(existingOrder?.lines.map((l) => l.lineId) ?? []);
        const newLinesForKitchen = existingOrder
          ? posDraft.lines.filter((l) => {
              if (!previousLineIds.has(l.lineId)) return true;
              const oldLine = existingOrder.lines.find((ol) => ol.lineId === l.lineId);
              return oldLine ? l.qty > oldLine.qty : false;
            })
          : posDraft.lines;

        const kotLinesToEmit = newLinesForKitchen.length > 0 ? newLinesForKitchen : posDraft.lines;

        const byStation = new Map<Station, OrderLine[]>();
        kotLinesToEmit.forEach((line) => {
          byStation.set(line.station, [...(byStation.get(line.station) ?? []), line]);
        });

        const newKots: Kot[] = [];
        byStation.forEach((stationLines, station) => {
          const kotId = `KOT-${nextKotSeq++}`;
          createdKotIds.push(kotId);
          newKots.push({
            id: kotId,
            orderId,
            station,
            status: "new",
            lines: stationLines.map((l) => ({ ...l })),
            createdAt: now,
          });
        });

        // Deduct stock only for lines not yet deducted
        const linesToDeduct =
          existingOrder && existingOrder.stockDeducted ? newLinesForKitchen : posDraft.lines;

        const { updatedIngredients, newMoves, newNotices } = deductOrderIngredients(
          linesToDeduct,
          s.menu,
          s.ingredients,
          s.stockMoves,
          orderId,
          now,
          s.settings.notifyLowStock,
          s.notices,
        );

        const updatedOrder: Order = existingOrder
          ? {
              ...existingOrder,
              type: posDraft.orderType,
              tableId: posDraft.orderType === "dine-in" ? posDraft.tableId : undefined,
              customerId: posDraft.customerId,
              guests: posDraft.guests,
              lines: posDraft.lines.map((l) => ({ ...l })),
              discountPct: posDraft.discountPct,
              status: "in-kitchen",
              stockDeducted: true,
              provider:
                posDraft.orderType === "delivery"
                  ? (posDraft.provider ?? existingOrder.provider ?? "Own fleet")
                  : undefined,
              deliveryStage:
                posDraft.orderType === "delivery"
                  ? (existingOrder.deliveryStage ?? "packing")
                  : undefined,
            }
          : {
              id: orderId,
              type: posDraft.orderType,
              tableId: posDraft.orderType === "dine-in" ? posDraft.tableId : undefined,
              customerId: posDraft.customerId,
              guests: posDraft.orderType === "dine-in" ? posDraft.guests : 0,
              lines: posDraft.lines.map((l) => ({ ...l })),
              discountPct: posDraft.discountPct,
              status: "in-kitchen",
              payment: "unpaid",
              createdAt: now,
              stockDeducted: true,
              provider:
                posDraft.orderType === "delivery" ? (posDraft.provider ?? "Own fleet") : undefined,
              deliveryStage: posDraft.orderType === "delivery" ? "packing" : undefined,
            };

        const nextOrders = existingOrder
          ? s.orders.map((o) => (o.id === existingOrder.id ? updatedOrder : o))
          : [updatedOrder, ...s.orders];

        const nextTables = s.tables.map((t) => {
          if (posDraft.orderType === "dine-in" && t.id === posDraft.tableId) {
            return {
              ...t,
              status: "occupied" as TableStatus,
              orderId,
              guests: posDraft.guests,
              since: t.since ?? now,
            };
          }
          return t;
        });

        newNotices.unshift({
          id: `N-ORD-${now}`,
          text: `${orderId} sent to kitchen (${createdKotIds.join(", ")})`,
          at: now,
          read: false,
          tone: "info",
        });

        return {
          orders: nextOrders,
          kots: [...newKots, ...s.kots],
          tables: nextTables,
          ingredients: updatedIngredients,
          stockMoves: newMoves,
          notices: newNotices.slice(0, 40),
          seq: { ...s.seq, order: nextOrderSeq, kot: nextKotSeq },
          posDraft: {
            ...s.posDraft,
            editingOrderId: orderId,
          },
        };
      });

      return { ok: true, orderId: resultOrderId, kotIds: createdKotIds };
    },

    requestBill: (orderId) => {
      updateAndPersist((state) => {
        const ord = state.orders.find((o) => o.id === orderId);
        if (!ord) return {};
        const nextOrders = state.orders.map((o) =>
          o.id === orderId && (o.status === "ready" || o.status === "in-kitchen")
            ? { ...o, status: "served" as OrderStatus }
            : o,
        );
        const nextTables = state.tables.map((t) =>
          t.id === ord.tableId || t.orderId === orderId
            ? { ...t, status: "billing" as TableStatus }
            : t,
        );
        return { orders: nextOrders, tables: nextTables };
      });
    },

    updateOrderDiscount: (orderId, discountPct) => {
      const state = get();
      if (!validDiscount(discountPct, state.settings.maxDiscountPct)) {
        return {
          ok: false,
          error: `Discount must be between 0% and ${state.settings.maxDiscountPct}%.`,
        };
      }
      const exists = state.orders.some((o) => o.id === orderId);
      if (!exists) {
        return { ok: false, error: "Order not found." };
      }
      updateAndPersist((s) => ({
        orders: s.orders.map((o) => (o.id === orderId ? { ...o, discountPct } : o)),
        posDraft:
          s.posDraft.editingOrderId === orderId ? { ...s.posDraft, discountPct } : s.posDraft,
      }));
      return { ok: true };
    },

    updateOrderNote: (orderId, note) => {
      updateAndPersist((s) => ({
        orders: s.orders.map((o) => (o.id === orderId ? { ...o, note } : o)),
        posDraft: s.posDraft.editingOrderId === orderId ? { ...s.posDraft, note } : s.posDraft,
      }));
    },

    sendOrderToKitchen: (orderId) => {
      const state = get();
      const ord = state.orders.find((o) => o.id === orderId);
      if (!ord) return { ok: false, error: "Order not found." };
      if (ord.status === "cancelled" || ord.status === "completed") {
        return { ok: false, error: `Cannot send ${ord.status} order to kitchen.` };
      }

      const now = Date.now();
      const createdKotIds: string[] = [];

      updateAndPersist((s) => {
        const existingKots = s.kots.filter((k) => k.orderId === orderId);
        let nextKotSeq = s.seq.kot;
        const newKots: Kot[] = [];

        if (existingKots.length === 0) {
          const byStation = new Map<Station, OrderLine[]>();
          ord.lines.forEach((l) =>
            byStation.set(l.station, [...(byStation.get(l.station) ?? []), l]),
          );
          byStation.forEach((stationLines, station) => {
            const kotId = `KOT-${nextKotSeq++}`;
            createdKotIds.push(kotId);
            newKots.push({
              id: kotId,
              orderId,
              station,
              status: "new",
              lines: stationLines.map((l) => ({ ...l })),
              createdAt: now,
            });
          });
        } else {
          existingKots.forEach((k) => createdKotIds.push(k.id));
        }

        const nextKots =
          existingKots.length > 0
            ? s.kots.map((k) =>
                k.orderId === orderId && k.status === "new"
                  ? { ...k, status: "preparing" as KotStatus, startedAt: k.startedAt ?? now }
                  : k,
              )
            : [...newKots, ...s.kots];

        const nextOrders = s.orders.map((o) =>
          o.id === orderId ? { ...o, status: "in-kitchen" as OrderStatus } : o,
        );

        return {
          kots: nextKots,
          orders: nextOrders,
          seq: { ...s.seq, kot: nextKotSeq },
        };
      });

      return { ok: true, kotIds: createdKotIds };
    },

    holdExistingOrder: (orderId) => {
      const ord = get().orders.find((o) => o.id === orderId);
      if (!ord) return { ok: false, error: "Order not found." };
      const now = Date.now();
      const heldId = `HOLD-${orderId.replace("ORD-", "")}`;
      updateAndPersist((s) => {
        const filteredHeld = s.held.filter((h) => h.id !== heldId);
        return {
          held: [
            {
              id: heldId,
              label: ord.tableId ? `Table ${ord.tableId} (${ord.id})` : `${ord.id} (${ord.type})`,
              tableId: ord.tableId,
              lines: ord.lines.map((l) => ({ ...l })),
              at: now,
            },
            ...filteredHeld,
          ],
        };
      });
      return { ok: true, heldId };
    },

    completePayment: (orderId, paymentMethod, discountPct, nextTableStatus = "available") => {
      const state = get();
      const ord = state.orders.find((o) => o.id === orderId);
      if (!ord) return { ok: false, error: "Order not found." };
      if (ord.payment === "paid") {
        return { ok: false, error: "Order is already marked as paid." };
      }
      const finalDiscount = discountPct ?? ord.discountPct;
      if (!validDiscount(finalDiscount, state.settings.maxDiscountPct)) {
        return {
          ok: false,
          error: `Discount exceeds maximum limit of ${state.settings.maxDiscountPct}%.`,
        };
      }

      const now = Date.now();
      const bill = totals(ord.lines, finalDiscount, state.settings.gstPct);
      const earnedPoints = Math.max(5, Math.floor(bill.total / 25));

      updateAndPersist((s) => {
        const nextOrders = s.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                discountPct: finalDiscount,
                payment: "paid" as const,
                paymentMethod,
                paidAt: now,
                status: "completed" as OrderStatus,
                deliveryStage: o.type === "delivery" ? ("delivered" as const) : o.deliveryStage,
              }
            : o,
        );

        const nextKots = s.kots.map((k) =>
          k.orderId === orderId ? { ...k, status: "served" as KotStatus } : k,
        );

        const nextTables = s.tables.map((t) =>
          t.id === ord.tableId || t.orderId === orderId
            ? {
                ...t,
                status: nextTableStatus as TableStatus,
                orderId: undefined,
                since: nextTableStatus === "cleaning" ? now : undefined,
                guests: 0,
              }
            : t,
        );

        const nextCustomers = s.customers.map((c) => {
          if (c.id !== ord.customerId) return c;
          const pts = c.points + earnedPoints;
          const tier: Customer["tier"] = pts >= 500 ? "Gold" : pts >= 250 ? "Silver" : "Bronze";
          return { ...c, points: pts, tier };
        });

        const nextPosDraft =
          s.posDraft.editingOrderId === orderId ? createDefaultPosDraft() : s.posDraft;

        return {
          orders: nextOrders,
          kots: nextKots,
          tables: nextTables,
          customers: nextCustomers,
          posDraft: nextPosDraft,
          notices: [
            {
              id: `N-PAY-${now}`,
              text: `Payment of ₹${bill.total.toLocaleString("en-IN")} received for ${orderId} via ${paymentMethod}`,
              at: now,
              read: false,
              tone: "success" as const,
            },
            ...s.notices,
          ].slice(0, 40),
        };
      });

      return { ok: true };
    },

    cancelOrder: (orderId) => {
      const state = get();
      const ord = state.orders.find((o) => o.id === orderId);
      if (!ord) return { ok: false, error: "Order not found." };
      if (ord.status === "completed") {
        return { ok: false, error: "Completed orders cannot be cancelled." };
      }

      updateAndPersist((s) => ({
        orders: s.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: "cancelled" as OrderStatus,
                payment: o.payment === "paid" ? ("refunded" as const) : ("unpaid" as const),
              }
            : o,
        ),
        kots: s.kots.filter((k) => k.orderId !== orderId),
        tables: s.tables.map((t) =>
          t.id === ord.tableId || t.orderId === orderId
            ? {
                ...t,
                status: "available" as TableStatus,
                orderId: undefined,
                since: undefined,
                guests: 0,
              }
            : t,
        ),
        posDraft: s.posDraft.editingOrderId === orderId ? createDefaultPosDraft() : s.posDraft,
      }));

      return { ok: true };
    },

    setTableStatus: (tableId, status, guests) => {
      updateAndPersist((state) => ({
        tables: state.tables.map((t) => {
          if (t.id !== tableId) return t;
          const isFree = status === "available" || status === "cleaning";
          return {
            ...t,
            status,
            guests: isFree ? 0 : (guests ?? (t.guests || 2)),
            orderId: isFree ? undefined : t.orderId,
            since: isFree ? undefined : (t.since ?? Date.now()),
          };
        }),
      }));
    },

    transferTable: (fromTableId, toTableId) => {
      if (fromTableId === toTableId) {
        return { ok: false, error: "Choose a different destination table." };
      }
      const state = get();
      const fromTbl = state.tables.find((t) => t.id === fromTableId);
      const toTbl = state.tables.find((t) => t.id === toTableId);
      if (!fromTbl || !toTbl) return { ok: false, error: "Table not found." };
      if (toTbl.status === "occupied" || toTbl.status === "billing") {
        return {
          ok: false,
          error: `Table ${toTbl.name} is currently occupied. Use Merge instead.`,
        };
      }

      updateAndPersist((s) => ({
        tables: s.tables.map((t) => {
          if (t.id === fromTableId) {
            return {
              ...t,
              status: "available" as TableStatus,
              guests: 0,
              orderId: undefined,
              since: undefined,
            };
          }
          if (t.id === toTableId) {
            return {
              ...t,
              status: fromTbl.status === "billing" ? "billing" : "occupied",
              guests: fromTbl.guests || 2,
              orderId: fromTbl.orderId,
              since: fromTbl.since ?? Date.now(),
            };
          }
          return t;
        }),
        orders: s.orders.map((o) =>
          o.id === fromTbl.orderId || (o.tableId === fromTableId && o.payment === "unpaid")
            ? { ...o, tableId: toTableId }
            : o,
        ),
      }));

      return { ok: true };
    },

    mergeTables: (primaryTableId, secondaryTableId) => {
      if (primaryTableId === secondaryTableId) {
        return { ok: false, error: "Select two distinct tables to merge." };
      }
      const state = get();
      const primary = state.tables.find((t) => t.id === primaryTableId);
      const secondary = state.tables.find((t) => t.id === secondaryTableId);
      if (!primary || !secondary) return { ok: false, error: "Tables not found." };

      updateAndPersist((s) => {
        const primaryOrder = s.orders.find(
          (o) =>
            (o.id === primary.orderId || o.tableId === primaryTableId) &&
            o.payment === "unpaid" &&
            o.status !== "cancelled",
        );
        const secondaryOrder = s.orders.find(
          (o) =>
            (o.id === secondary.orderId || o.tableId === secondaryTableId) &&
            o.payment === "unpaid" &&
            o.status !== "cancelled",
        );

        let nextOrders = [...s.orders];
        let nextKots = [...s.kots];
        let activeOrderId = primaryOrder?.id ?? secondaryOrder?.id;

        if (primaryOrder && secondaryOrder && primaryOrder.id !== secondaryOrder.id) {
          const mergedOrder: Order = {
            ...primaryOrder,
            guests: primaryOrder.guests + secondaryOrder.guests,
            lines: [...primaryOrder.lines, ...secondaryOrder.lines],
          };
          nextOrders = s.orders
            .filter((o) => o.id !== secondaryOrder.id)
            .map((o) => (o.id === primaryOrder.id ? mergedOrder : o));
          nextKots = s.kots.map((k) =>
            k.orderId === secondaryOrder.id ? { ...k, orderId: primaryOrder.id } : k,
          );
          activeOrderId = primaryOrder.id;
        } else if (!primaryOrder && secondaryOrder) {
          nextOrders = s.orders.map((o) =>
            o.id === secondaryOrder.id ? { ...o, tableId: primaryTableId } : o,
          );
          activeOrderId = secondaryOrder.id;
        }

        const nextTables = s.tables.map((t) => {
          if (t.id === primaryTableId) {
            return {
              ...t,
              status: "occupied" as TableStatus,
              guests: (primary.guests || 2) + (secondary.guests || 2),
              orderId: activeOrderId,
              since: primary.since ?? secondary.since ?? Date.now(),
            };
          }
          if (t.id === secondaryTableId) {
            return {
              ...t,
              status: "available" as TableStatus,
              guests: 0,
              orderId: undefined,
              since: undefined,
            };
          }
          return t;
        });

        return { orders: nextOrders, kots: nextKots, tables: nextTables };
      });

      return { ok: true };
    },

    splitTableBill: (orderId, lineIdsToSplit) => {
      const state = get();
      const ord = state.orders.find((o) => o.id === orderId);
      if (!ord) return { ok: false, error: "Order not found." };
      if (ord.lines.length < 2) {
        return { ok: false, error: "Order must have at least 2 item lines to split." };
      }
      const splitSet = new Set(
        lineIdsToSplit.length > 0
          ? lineIdsToSplit
          : ord.lines.slice(Math.ceil(ord.lines.length / 2)).map((l) => l.lineId),
      );
      const remainingLines = ord.lines.filter((l) => !splitSet.has(l.lineId));
      const movedLines = ord.lines.filter((l) => splitSet.has(l.lineId));
      if (remainingLines.length === 0 || movedLines.length === 0) {
        return { ok: false, error: "Keep at least one line in each split bill." };
      }

      let newOrderId = "";
      updateAndPersist((s) => {
        const nextOrderSeq = s.seq.order;
        newOrderId = `ORD-${nextOrderSeq}`;
        const splitOrder: Order = {
          ...ord,
          id: newOrderId,
          guests: Math.max(1, Math.floor(ord.guests / 2)),
          lines: movedLines,
          createdAt: Date.now(),
        };
        const updatedOriginal: Order = {
          ...ord,
          guests: Math.max(1, ord.guests - splitOrder.guests),
          lines: remainingLines,
        };
        return {
          orders: [splitOrder, ...s.orders.map((o) => (o.id === orderId ? updatedOriginal : o))],
          seq: { ...s.seq, order: nextOrderSeq + 1 },
        };
      });

      return { ok: true, newOrderId };
    },

    saveTablesLayout: (tables) => {
      updateAndPersist(() => ({
        tables: tables.map((t) => ({
          ...t,
          x: Math.max(0.06, Math.min(0.94, t.x)),
          y: Math.max(0.08, Math.min(0.92, t.y)),
        })),
      }));
    },

    addDiningTable: (input) => {
      const state = get();
      const cleanName = input.name.trim().toUpperCase();
      if (!cleanName) {
        return { ok: false, error: "Table ID / Name is required." };
      }
      const id = (input.id ?? cleanName).trim().toUpperCase();
      if (
        state.tables.some((t) => t.id.toUpperCase() === id || t.name.toUpperCase() === cleanName)
      ) {
        return { ok: false, error: `Table ${cleanName} already exists.` };
      }
      const newTable: DiningTable = {
        id,
        name: cleanName,
        area: input.area,
        capacity: Math.max(1, Math.min(20, Math.round(input.capacity))),
        status: "available",
        guests: 0,
        x: Math.max(0.08, Math.min(0.92, input.x ?? 0.5)),
        y: Math.max(0.1, Math.min(0.9, input.y ?? 0.5)),
        shape: input.shape,
        scale: input.scale ?? 1,
        rotation: input.rotation ?? 0,
      };
      updateAndPersist((s) => ({
        tables: [...s.tables, newTable],
      }));
      return { ok: true, table: newTable };
    },

    updateDiningTable: (tableId, patch) => {
      const state = get();
      const target = state.tables.find((t) => t.id === tableId);
      if (!target) {
        return { ok: false, error: "Table not found." };
      }
      if (patch.name !== undefined) {
        const cleanName = patch.name.trim().toUpperCase();
        if (!cleanName) {
          return { ok: false, error: "Table name cannot be empty." };
        }
        if (state.tables.some((t) => t.id !== tableId && t.name.toUpperCase() === cleanName)) {
          return { ok: false, error: `Table ${cleanName} already exists.` };
        }
      }
      updateAndPersist((s) => ({
        tables: s.tables.map((t) => {
          if (t.id !== tableId) return t;
          return {
            ...t,
            ...(patch.name !== undefined ? { name: patch.name.trim().toUpperCase() } : {}),
            ...(patch.area !== undefined ? { area: patch.area } : {}),
            ...(patch.capacity !== undefined
              ? { capacity: Math.max(1, Math.min(20, Math.round(patch.capacity))) }
              : {}),
            ...(patch.shape !== undefined ? { shape: patch.shape } : {}),
            ...(patch.x !== undefined ? { x: Math.max(0.06, Math.min(0.94, patch.x)) } : {}),
            ...(patch.y !== undefined ? { y: Math.max(0.08, Math.min(0.92, patch.y)) } : {}),
            ...(patch.scale !== undefined
              ? { scale: Math.max(0.7, Math.min(1.4, patch.scale)) }
              : {}),
            ...(patch.rotation !== undefined ? { rotation: patch.rotation % 360 } : {}),
          };
        }),
      }));
      return { ok: true };
    },

    deleteDiningTable: (tableId) => {
      const state = get();
      const target = state.tables.find((t) => t.id === tableId);
      if (!target) {
        return { ok: false, error: "Table not found." };
      }
      const hasActiveOrder = state.orders.some(
        (o) =>
          (o.tableId === tableId || o.id === target.orderId) &&
          o.payment === "unpaid" &&
          o.status !== "cancelled" &&
          o.status !== "completed",
      );
      if (hasActiveOrder) {
        return {
          ok: false,
          error: `Table ${target.name} has an active unpaid order and cannot be deleted.`,
        };
      }
      updateAndPersist((s) => ({
        tables: s.tables.filter((t) => t.id !== tableId),
      }));
      return { ok: true };
    },

    updateKotStatus: (kotId, status) => {
      const now = Date.now();
      updateAndPersist((state) => {
        const targetKot = state.kots.find((k) => k.id === kotId);
        if (!targetKot) return {};

        const nextKots = state.kots.map((k) => {
          if (k.id !== kotId) return k;
          return {
            ...k,
            status,
            startedAt:
              (status === "preparing" || status === "accepted") && !k.startedAt ? now : k.startedAt,
            readyAt: status === "ready" || status === "served" ? (k.readyAt ?? now) : k.readyAt,
          };
        });

        const orderKots = nextKots.filter((k) => k.orderId === targetKot.orderId);
        const derivedStatus = deriveOrderStatusFromKots(orderKots);
        const allServed = orderKots.length > 0 && orderKots.every((k) => k.status === "served");

        const nextOrders = state.orders.map((o) => {
          if (o.id !== targetKot.orderId) return o;
          if (o.status === "completed" || o.status === "cancelled") return o;
          const nextOrderStatus: OrderStatus = allServed ? "served" : (derivedStatus ?? o.status);
          return { ...o, status: nextOrderStatus };
        });

        const nextNotices = [...state.notices];
        if (derivedStatus === "ready" && status === "ready") {
          nextNotices.unshift({
            id: `N-KOT-${now}`,
            text: `Order ${targetKot.orderId} (${targetKot.station}) is READY for pickup/service`,
            at: now,
            read: false,
            tone: "success",
          });
        }

        return {
          kots: nextKots,
          orders: nextOrders,
          notices: nextNotices.slice(0, 40),
        };
      });
    },

    advanceKot: (kotId) => {
      const kot = get().kots.find((k) => k.id === kotId);
      if (!kot) return;
      const order: Record<KotStatus, KotStatus> = {
        new: "accepted",
        accepted: "preparing",
        preparing: "ready",
        ready: "served",
        served: "served",
      };
      get().updateKotStatus(kotId, order[kot.status]);
    },

    markOrderServed: (orderId) => {
      updateAndPersist((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId && o.status !== "completed" ? { ...o, status: "served" } : o,
        ),
        kots: state.kots.map((k) => (k.orderId === orderId ? { ...k, status: "served" } : k)),
      }));
    },

    toggleMenuAvailability: (itemId) => {
      updateAndPersist((state) => ({
        menu: state.menu.map((m) => (m.id === itemId ? { ...m, available: !m.available } : m)),
      }));
    },

    updateMenuPrice: (itemId, price) => {
      if (!Number.isFinite(price) || price <= 0) return;
      updateAndPersist((state) => ({
        menu: state.menu.map((m) => (m.id === itemId ? { ...m, price: Math.round(price) } : m)),
      }));
    },

    saveMenuItem: (item) => {
      let savedId = item.id ?? "";
      updateAndPersist((state) => {
        if (item.id && state.menu.some((m) => m.id === item.id)) {
          savedId = item.id;
          return {
            menu: state.menu.map((m) => (m.id === item.id ? { ...m, ...item, id: item.id } : m)),
          };
        }
        const maxNum = state.menu.reduce((max, m) => {
          const n = Number(m.id.replace(/\D/g, "")) || 0;
          return n > max ? n : max;
        }, 43);
        savedId = `M${maxNum + 1}`;
        const created: MenuItem = { ...item, id: savedId };
        return { menu: [created, ...state.menu] };
      });
      return savedId;
    },

    duplicateMenuItem: (itemId) => {
      const state = get();
      const source = state.menu.find((m) => m.id === itemId);
      if (!source) {
        return { ok: false, error: "Menu item not found." };
      }
      const maxNum = state.menu.reduce((max, m) => {
        const n = Number(m.id.replace(/\D/g, "")) || 0;
        return n > max ? n : max;
      }, 43);
      const newId = `M${maxNum + 1}`;
      const newItem: MenuItem = {
        ...source,
        id: newId,
        name: `${source.name} (Copy)`,
        recipe: source.recipe.map((r) => ({ ...r })),
        ...(source.tags ? { tags: [...source.tags] } : {}),
        ...(source.modifiers ? { modifiers: [...source.modifiers] } : {}),
        ...(source.addons ? { addons: source.addons.map((a) => ({ ...a })) } : {}),
      };
      updateAndPersist((s) => ({
        menu: [newItem, ...s.menu],
      }));
      return { ok: true, newItem };
    },

    deleteMenuItem: (itemId) => {
      const state = get();
      const target = state.menu.find((m) => m.id === itemId);
      if (!target) {
        return { ok: false, error: "Menu item not found." };
      }
      updateAndPersist((s) => ({
        menu: s.menu.filter((m) => m.id !== itemId),
      }));
      return { ok: true };
    },

    toggleComboAvailability: (comboId) => {
      updateAndPersist((state) => ({
        combos: state.combos.map((c) => (c.id === comboId ? { ...c, available: !c.available } : c)),
      }));
    },

    saveCombo: (combo) => {
      let id = combo.id ?? "";
      updateAndPersist((state) => {
        if (combo.id && state.combos.some((c) => c.id === combo.id)) {
          id = combo.id;
          return {
            combos: state.combos.map((c) => (c.id === combo.id ? { ...combo, id: combo.id } : c)),
          };
        }
        id = `CMB-${state.combos.length + 1}`;
        return { combos: [...state.combos, { ...combo, id }] };
      });
      return id;
    },

    createPurchaseOrder: (supplierId, lines) => {
      const validLines = lines.filter((l) => l.qty > 0);
      if (!supplierId || validLines.length === 0) {
        return {
          ok: false,
          error: "Select a supplier and at least one ingredient with quantity > 0.",
        };
      }
      let poId = "";
      updateAndPersist((state) => {
        poId = `PO-${state.seq.po}`;
        const po: PurchaseOrder = {
          id: poId,
          supplierId,
          lines: validLines,
          status: "pending",
          createdAt: Date.now(),
        };
        return {
          purchaseOrders: [po, ...state.purchaseOrders],
          seq: { ...state.seq, po: state.seq.po + 1 },
        };
      });
      return { ok: true, poId };
    },

    receivePurchaseOrder: (poId) => {
      const state = get();
      const po = state.purchaseOrders.find((p) => p.id === poId);
      if (!po) return { ok: false, error: "Purchase order not found." };
      if (po.status === "received") {
        return { ok: false, error: "Purchase order has already been received." };
      }
      const now = Date.now();
      updateAndPersist((s) => {
        const nextIngredients = s.ingredients.map((ing) => {
          const line = po.lines.find((l) => l.ingredientId === ing.id);
          if (!line) return ing;
          return { ...ing, stock: Math.round((ing.stock + line.qty) * 100) / 100 };
        });
        const newMoves: StockMove[] = po.lines.map((l, idx) => ({
          id: `SM-PO-${now}-${idx}`,
          ingredientId: l.ingredientId,
          qty: l.qty,
          reason: "purchase",
          ref: poId,
          at: now,
        }));
        const sup = s.suppliers.find((sp) => sp.id === po.supplierId);
        return {
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === poId ? { ...p, status: "received", receivedAt: now } : p,
          ),
          ingredients: nextIngredients,
          stockMoves: [...newMoves, ...s.stockMoves],
          notices: [
            {
              id: `N-PO-${now}`,
              text: `${poId} received from ${sup?.name ?? "Supplier"} — inventory updated`,
              at: now,
              read: false,
              tone: "success" as const,
            },
            ...s.notices,
          ].slice(0, 40),
        };
      });
      return { ok: true };
    },

    cancelPurchaseOrder: (poId) => {
      updateAndPersist((state) => ({
        purchaseOrders: state.purchaseOrders.map((p) =>
          p.id === poId && p.status === "pending" ? { ...p, status: "cancelled" } : p,
        ),
      }));
    },

    adjustIngredientStock: (ingredientId, deltaQty, reason, ref) => {
      if (!Number.isFinite(deltaQty) || deltaQty === 0) return;
      const now = Date.now();
      updateAndPersist((state) => {
        const nextIngredients = state.ingredients.map((ing) => {
          if (ing.id !== ingredientId) return ing;
          const nextStock = Math.max(0, Math.round((ing.stock + deltaQty) * 100) / 100);
          return { ...ing, stock: nextStock };
        });
        const move: StockMove = {
          id: `SM-ADJ-${now}`,
          ingredientId,
          qty: deltaQty,
          reason,
          ref: ref.trim() || reason.toUpperCase(),
          at: now,
        };
        return {
          ingredients: nextIngredients,
          stockMoves: [move, ...state.stockMoves],
        };
      });
    },

    saveIngredient: (ing) => {
      let id = ing.id ?? "";
      updateAndPersist((state) => {
        if (ing.id && state.ingredients.some((i) => i.id === ing.id)) {
          id = ing.id;
          return {
            ingredients: state.ingredients.map((i) =>
              i.id === ing.id ? { ...ing, id: ing.id } : i,
            ),
          };
        }
        id = `I${state.ingredients.length + 1}`;
        return { ingredients: [...state.ingredients, { ...ing, id }] };
      });
      return id;
    },

    saveSupplier: (sup) => {
      let id = sup.id ?? "";
      updateAndPersist((state) => {
        if (sup.id && state.suppliers.some((s) => s.id === sup.id)) {
          id = sup.id;
          return {
            suppliers: state.suppliers.map((s) => (s.id === sup.id ? { ...sup, id: sup.id } : s)),
          };
        }
        id = `S${state.suppliers.length + 1}`;
        return { suppliers: [...state.suppliers, { ...sup, id }] };
      });
      return id;
    },

    createReservation: (res) => {
      let id = "";
      updateAndPersist((state) => {
        id = `RES-${state.seq.res}`;
        const created: Reservation = { ...res, id };
        const nextTables = state.tables.map((t) => {
          if (
            res.tableId &&
            t.id === res.tableId &&
            t.status === "available" &&
            (res.status === "booked" || res.status === "confirmed")
          ) {
            return { ...t, status: "reserved" as TableStatus, guests: res.party };
          }
          return t;
        });
        return {
          reservations: [created, ...state.reservations],
          tables: nextTables,
          seq: { ...state.seq, res: state.seq.res + 1 },
        };
      });
      return id;
    },

    updateReservationStatus: (resId, status, tableId) => {
      updateAndPersist((state) => {
        const current = state.reservations.find((r) => r.id === resId);
        if (!current) return {};
        const assignedTableId = tableId ?? current.tableId;
        const nextReservations = state.reservations.map((r) =>
          r.id === resId ? { ...r, status, tableId: assignedTableId } : r,
        );
        const nextTables = state.tables.map((t) => {
          if (t.id !== assignedTableId) return t;
          if (status === "seated") {
            return {
              ...t,
              status: "occupied" as TableStatus,
              guests: current.party,
              since: t.since ?? Date.now(),
            };
          }
          if (status === "booked" || status === "confirmed") {
            return t.status === "available"
              ? { ...t, status: "reserved" as TableStatus, guests: current.party }
              : t;
          }
          if ((status === "cancelled" || status === "completed") && t.status === "reserved") {
            return { ...t, status: "available" as TableStatus, guests: 0 };
          }
          return t;
        });
        return { reservations: nextReservations, tables: nextTables };
      });
    },

    assignReservationTable: (resId, tableId) => {
      updateAndPersist((state) => {
        const res = state.reservations.find((r) => r.id === resId);
        if (!res) return {};
        const prevTableId = res.tableId;
        return {
          reservations: state.reservations.map((r) => (r.id === resId ? { ...r, tableId } : r)),
          tables: state.tables.map((t) => {
            if (prevTableId && t.id === prevTableId && t.status === "reserved") {
              return { ...t, status: "available" as TableStatus, guests: 0 };
            }
            if (
              tableId &&
              t.id === tableId &&
              t.status === "available" &&
              (res.status === "booked" || res.status === "confirmed")
            ) {
              return { ...t, status: "reserved" as TableStatus, guests: res.party };
            }
            return t;
          }),
        };
      });
    },

    saveCustomer: (cust) => {
      let id = cust.id ?? "";
      updateAndPersist((state) => {
        if (cust.id && state.customers.some((c) => c.id === cust.id)) {
          id = cust.id;
          return {
            customers: state.customers.map((c) =>
              c.id === cust.id ? { ...cust, id: cust.id } : c,
            ),
          };
        }
        id = `C${state.customers.length + 1}`;
        return { customers: [{ ...cust, id }, ...state.customers] };
      });
      return id;
    },

    adjustCustomerPoints: (customerId, delta) => {
      updateAndPersist((state) => ({
        customers: state.customers.map((c) => {
          if (c.id !== customerId) return c;
          const points = Math.max(0, c.points + delta);
          const tier: Customer["tier"] =
            points >= 500 ? "Gold" : points >= 250 ? "Silver" : "Bronze";
          return { ...c, points, tier };
        }),
      }));
    },

    toggleStaffPresent: (staffId) => {
      updateAndPersist((state) => ({
        staff: state.staff.map((st) => (st.id === staffId ? { ...st, present: !st.present } : st)),
      }));
    },

    updateStaffMember: (staffId, patch) => {
      updateAndPersist((state) => ({
        staff: state.staff.map((st) => (st.id === staffId ? { ...st, ...patch } : st)),
      }));
    },

    addStaffMember: (member) => {
      let id = "";
      updateAndPersist((state) => {
        id = `E${state.staff.length + 1}`;
        return { staff: [...state.staff, { ...member, id }] };
      });
      return id;
    },

    advanceDeliveryOrder: (orderId) => {
      updateAndPersist((state) => ({
        orders: state.orders.map((o) => {
          if (o.id !== orderId || o.type !== "delivery") return o;
          const stage = o.deliveryStage ?? "packing";
          const nextStage =
            stage === "packing" ? "dispatched" : stage === "dispatched" ? "delivered" : "delivered";
          const nextStatus: OrderStatus =
            nextStage === "delivered" ? "completed" : o.status === "open" ? "ready" : o.status;
          return {
            ...o,
            deliveryStage: nextStage,
            status: nextStatus,
          };
        }),
      }));
    },

    updateDeliveryProvider: (orderId, provider) => {
      updateAndPersist((state) => ({
        orders: state.orders.map((o) => (o.id === orderId ? { ...o, provider } : o)),
      }));
    },

    updateSettings: (patch) => {
      updateAndPersist((state) => {
        const nextSettings = { ...state.settings, ...patch };
        if (typeof document !== "undefined" && patch.dark !== undefined) {
          document.documentElement.classList.toggle("dark", patch.dark);
        }
        return { settings: nextSettings };
      });
    },

    setProfile: (profile) => {
      updateAndPersist((state) => ({
        settings: { ...state.settings, profile },
      }));
    },

    setBranch: (branch) => {
      updateAndPersist((state) => ({
        settings: { ...state.settings, branch },
      }));
    },

    toggleDark: () => {
      updateAndPersist((state) => {
        const dark = !state.settings.dark;
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", dark);
        }
        return { settings: { ...state.settings, dark } };
      });
    },

    addNotice: (text, tone = "info") => {
      const now = Date.now();
      updateAndPersist((state) => ({
        notices: [
          {
            id: `N-${now}-${Math.random().toString(36).slice(2, 5)}`,
            text,
            at: now,
            read: false,
            tone,
          },
          ...state.notices,
        ].slice(0, 40),
      }));
    },

    markNoticeRead: (id) => {
      updateAndPersist((state) => ({
        notices: state.notices.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },

    markAllNoticesRead: () => {
      updateAndPersist((state) => ({
        notices: state.notices.map((n) => ({ ...n, read: true })),
      }));
    },

    resetDemoData: () => {
      const fresh = buildSeed();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("dark");
      }
      set({
        ...fresh,
        combos: INITIAL_COMBOS.map((c) => ({ ...c })),
        posDraft: createDefaultPosDraft(fresh),
      });
    },
  };
});

/**
 * Clean service interface abstraction so the frontend can later be connected
 * to FastAPI and PostgreSQL endpoints without rewriting UI components.
 */
export const restaurantService = {
  getState: () => useRestaurantStore.getState(),
  submitOrder: () => useRestaurantStore.getState().submitPosOrder(),
  completePayment: (orderId: string, method: string, discountPct?: number) =>
    useRestaurantStore.getState().completePayment(orderId, method, discountPct),
  updateKotStatus: (kotId: string, status: KotStatus) =>
    useRestaurantStore.getState().updateKotStatus(kotId, status),
  receivePurchaseOrder: (poId: string) => useRestaurantStore.getState().receivePurchaseOrder(poId),
  resetDemoData: () => useRestaurantStore.getState().resetDemoData(),
};
