/**
 * In-memory unified restaurant store synchronized with PostgreSQL microservices.
 * Coordinates orders, tables, reservations, menu, recipes, inventory, suppliers,
 * purchase orders, customers, staff, payments, settings and real-time AI insights
 * scoped per Organization (`tenant_id`) and Outlet (`outlet_id`).
 *
 * All state mutations notify subscribers via React's useSyncExternalStore
 * and persist asynchronously to their owning backend microservice.
 */
import { useSyncExternalStore } from "react";
import {
  customers as seedCustomers,
  staff as seedStaff,
} from "@/data/business";
import type {
  Customer,
  InventoryItem,
  MenuItem,
  Order,
  OrderLine,
  OrderStatus,
  OrderType,
  Payment,
  PaymentMethod,
  PurchaseOrder,
  Recipe,
  Reservation,
  RestaurantSettings,
  RestaurantTable,
  StaffMember,
  StaffShift,
  Supplier,
} from "@/lib/types";
import { inventoryService } from "./inventoryService";
import { organizationService } from "./organizationService";
import { menuService } from "./menuService";
import { posService } from "./posService";
import { kitchenService } from "./kitchenService";
import { billingService } from "./billingService";
import { updateReceiptTemplate } from "./receiptTemplateService";
import { getActiveOutlet, getActiveTenant, setActiveOutlet } from "@/lib/auth-tokens";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(val?: string | null): val is string {
  return Boolean(val && UUID_RE.test(val));
}

let activeOutletUuid: string = getActiveOutlet() || "11111111-2222-3333-4444-555555555555";
let activeStationUuid: string | null = null;
const outletsMap = new Map<string, { id: string; name: string; address?: string; phone?: string }>();
const sectionsMap = new Map<string, string>(); // sectionName.toLowerCase() -> sectionUuid

/**
 * Resolve active outlet UUID dynamically for the logged-in organization/branch.
 */
export function resolveActiveOutletId(): string {
  const fromToken = getActiveOutlet();
  if (isValidUuid(fromToken)) {
    activeOutletUuid = fromToken;
    return fromToken;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const brRaw = localStorage.getItem("bos-branch");
      if (brRaw) {
        const parsed = JSON.parse(brRaw);
        if (isValidUuid(parsed?.id)) {
          activeOutletUuid = parsed.id;
          return parsed.id;
        }
      }
    } catch {
      // ignore
    }
  }
  return activeOutletUuid;
}

/**
 * Resolve PostgreSQL table UUID from either a display code ("T1") or UUID.
 */
export function resolveTableUuid(tableIdOrCode?: string | null): string | undefined {
  if (!tableIdOrCode) return undefined;
  if (isValidUuid(tableIdOrCode)) return tableIdOrCode;
  const match = tables.find(
    (t) =>
      t.id === tableIdOrCode ||
      t.code === tableIdOrCode ||
      t.name === tableIdOrCode ||
      t.backendId === tableIdOrCode
  );
  return isValidUuid(match?.backendId) ? match!.backendId : undefined;
}

/**
 * Resolve display table code ("T1") from a PostgreSQL table UUID or code.
 */
export function resolveTableCode(tableUuidOrCode?: string | null): string | undefined {
  if (!tableUuidOrCode) return undefined;
  const match = tables.find(
    (t) =>
      t.backendId === tableUuidOrCode ||
      t.id === tableUuidOrCode ||
      t.code === tableUuidOrCode
  );
  return match ? match.id : tableUuidOrCode;
}

// ==========================================
// 1. STATE INITIALIZATION (Zero Mock Fallbacks)
// ==========================================

let orders: Order[] = [];
let tables: RestaurantTable[] = [];
let reservations: Reservation[] = [];
let menuItems: MenuItem[] = [];
let inventory: InventoryItem[] = [];
let customers: Customer[] = seedCustomers.map((c) => ({ ...c, tags: [...c.tags] }));
let staff: StaffMember[] = seedStaff.map((s) => ({ ...s }));

const toFrontendStatus = (s: string): RestaurantTable["status"] => {
  switch (s?.toLowerCase()) {
    case "free":
    case "available":
      return "Available";
    case "occupied":
      return "Occupied";
    case "billing":
    case "billed":
      return "Billing";
    case "reserved":
      return "Reserved";
    case "cleaning":
    case "dirty":
      return "Cleaning";
    default:
      return "Available";
  }
};

const toBackendTableStatus = (s: RestaurantTable["status"]): string => {
  switch (s) {
    case "Available":
      return "available";
    case "Occupied":
      return "occupied";
    case "Billing":
      return "billed";
    case "Reserved":
      return "reserved";
    case "Cleaning":
      return "cleaning";
    default:
      return "available";
  }
};

let settings: RestaurantSettings = {
  name: "Sunrise Restaurant & Bar",
  tagline: "Authentic Flavours & Modern Hospitality",
  currentBranch: "Hyderabad — Banjara Hills",
  branches: ["Hyderabad — Banjara Hills", "Hyderabad — Jubilee Hills"],
  manager: "Venkat Rao",
  register: "POS Terminal 1",
  gstin: "36AABCS1429B1Z1",
  fssai: "13621014000452",
  phone: "+91 40 2335 8899",
  email: "support@sunrise-restaurant.in",
  address: "Road No. 12, Banjara Hills, Hyderabad, Telangana 500034",
  taxRate: 0.05,
  serviceCharge: 0.05,
  currencySymbol: "₹",
  autoPrintKOT: true,
  soundAlerts: true,
};

/**
 * Fetch and synchronize live PostgreSQL records across all microservices
 * scoped to the active Organization (`tenant_id`) and Outlet (`outlet_id`).
 */
export async function initRestaurantStore() {
  try {
    const [
      fetchedOutlets,
      fetchedTables,
      fetchedSections,
      fetchedMenu,
      fetchedOrders,
      fetchedInv,
      fetchedRes,
      fetchedStations,
      fetchedKots,
      fetchedBills,
    ] = await Promise.all([
      organizationService.getOutlets().catch(() => []),
      organizationService.getTables().catch(() => []),
      organizationService.getSections().catch(() => []),
      menuService.getItems().catch(() => []),
      posService.getOrders({ limit: 50 }).catch(() => []),
      inventoryService.getItems().catch(() => []),
      posService.getReservations().catch(() => []),
      kitchenService.getStations().catch(() => []),
      kitchenService.getKOTs().catch(() => []),
      billingService.getBills(undefined, 50).catch(() => []),
    ]);

    // 1. Resolve Outlets & Organization Settings
    if (Array.isArray(fetchedOutlets) && fetchedOutlets.length > 0) {
      outletsMap.clear();
      fetchedOutlets.forEach((o: any) => {
        outletsMap.set(o.name, { id: o.id, name: o.name, address: o.address, phone: o.phone });
      });
      const currentTokenOutlet = getActiveOutlet();
      const matchedOutlet =
        fetchedOutlets.find((o: any) => o.id === currentTokenOutlet) || fetchedOutlets[0];
      if (matchedOutlet?.id) {
        activeOutletUuid = matchedOutlet.id;
        if (!currentTokenOutlet) {
          setActiveOutlet(matchedOutlet.id);
        }
        settings = {
          ...settings,
          currentBranch: matchedOutlet.name || settings.currentBranch,
          branches: fetchedOutlets.map((o: any) => o.name),
          phone: matchedOutlet.phone || settings.phone,
          address: matchedOutlet.address || settings.address,
        };
      }
    }

    // Check active company metadata from tenant context if available
    if (typeof localStorage !== "undefined") {
      try {
        const tid = getActiveTenant();
        const gstRaw =
          (tid && localStorage.getItem(`bos_active_billing_gst_details_${tid}`)) ||
          localStorage.getItem("bos_active_billing_gst_details");
        if (gstRaw) {
          const gst = JSON.parse(gstRaw);
          if (gst?.trade_name || gst?.legal_name) {
            settings = {
              ...settings,
              name: gst.trade_name || gst.legal_name || settings.name,
              gstin: gst.gstin || settings.gstin,
              phone: gst.phone || settings.phone,
              email: gst.email || settings.email,
              address: gst.address || settings.address,
            };
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Resolve Kitchen Stations
    if (Array.isArray(fetchedStations) && fetchedStations.length > 0 && fetchedStations[0]) {
      activeStationUuid = fetchedStations[0].id;
    }

    // 3. Resolve Floor Sections & Tables (preserving both display `id` and PostgreSQL `backendId`)
    const secIdToName = new Map<string, string>();
    sectionsMap.clear();
    fetchedSections.forEach((s: any) => {
      secIdToName.set(s.id, s.name);
      sectionsMap.set(String(s.name).toLowerCase(), s.id);
    });

    const tableUuidToCode = new Map<string, string>();
    if (fetchedTables.length > 0) {
      tables = (fetchedTables as any[]).map((t) => {
        const displayCode = t.code || t.name || t.id;
        if (t.id) tableUuidToCode.set(String(t.id), displayCode);
        return {
          id: displayCode,
          backendId: t.id,
          name: t.name || `Table ${displayCode}`,
          code: t.code || displayCode,
          area: (t.section_id && secIdToName.get(t.section_id)) || "Main Hall",
          seats: Number(t.seats || t.capacity || 4),
          shape: t.shape || "round",
          status: toFrontendStatus(t.status),
          posX: t.position_x !== null && t.position_x !== undefined ? Number(t.position_x) : 50,
          posY: t.position_y !== null && t.position_y !== undefined ? Number(t.position_y) : 50,
          waiter: "Ravi",
        };
      });
    }

    // 4. Resolve Menu Items
    if (fetchedMenu.length > 0) {
      menuItems = fetchedMenu.map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description || "Freshly cooked specialty dish",
        category: m.category_name || "Main Course",
        price: Number(m.base_price || 0),
        prepMins: Number(m.prep_time_minutes || 15),
        veg: m.is_veg !== undefined ? Boolean(m.is_veg) : m.item_type === "veg",
        available: m.is_available ?? true,
        station: "Main",
        costPct: 30,
      }));
    }

    // 5. Index KOTs and Bills by order_id / order_number for cross-linking
    const kotByOrderKey = new Map<string, string>();
    if (Array.isArray(fetchedKots)) {
      fetchedKots.forEach((k: any) => {
        if (k.order_id) kotByOrderKey.set(String(k.order_id), String(k.id));
        if (k.order_number) kotByOrderKey.set(String(k.order_number), String(k.id));
      });
    }

    const billByOrderKey = new Map<string, { id: string; bill_number: string; status: string }>();
    if (Array.isArray(fetchedBills)) {
      fetchedBills.forEach((b: any) => {
        if (b.order_id) billByOrderKey.set(String(b.order_id), b);
        if (b.order_number) billByOrderKey.set(String(b.order_number), b);
      });
    }

    // 6. Resolve Orders and cross-link with Tables, KOTs, and Bills
    if (fetchedOrders.length > 0) {
      orders = fetchedOrders.map((o: any) => {
        const displayId = o.order_number || o.id;
        const resolvedTableCode = o.table_id
          ? tableUuidToCode.get(String(o.table_id)) || resolveTableCode(String(o.table_id))
          : undefined;
        const linkedKotId = kotByOrderKey.get(String(o.id)) || kotByOrderKey.get(String(displayId));
        const linkedBill = billByOrderKey.get(String(o.id)) || billByOrderKey.get(String(displayId));
        const isSettled = o.status === "settled" || linkedBill?.status === "settled";
        return {
          id: displayId,
          backendId: o.id,
          backendKotId: linkedKotId,
          backendBillId: linkedBill?.id,
          billNumber: linkedBill?.bill_number,
          type:
            o.order_type === "dine_in"
              ? "Dine-in"
              : o.order_type === "takeaway"
                ? "Takeaway"
                : "Delivery",
          status:
            o.status === "placed"
              ? "New"
              : o.status === "preparing"
                ? "Preparing"
                : o.status === "ready"
                  ? "Ready"
                  : o.status === "served"
                    ? "Served"
                    : o.status === "settled"
                      ? "Completed"
                      : "Cancelled",
          table: resolvedTableCode,
          customer: o.customer_name || "Guest",
          phone: o.customer_phone,
          lines: (o.lines || o.items || []).map((l: any) => ({
            id: l.id || crypto.randomUUID(),
            itemId: l.menu_item_id || l.id,
            name: l.item_name || l.name,
            qty: Number(l.qty || l.quantity || 1),
            unitPrice: Number(l.unit_price || 0),
            modifiers: [],
            note: l.notes,
            station: "Main",
          })),
          createdAt: new Date(o.created_at || Date.now()).getTime(),
          waiter: "Ravi",
          paid: isSettled,
        };
      });

      // Ensure active Dine-in orders reflect on their floor table's orderId
      const activeByTable = new Map<string, Order>();
      for (const ord of orders) {
        if (ord.table && !ord.paid && ord.status !== "Cancelled" && ord.status !== "Completed") {
          if (!activeByTable.has(ord.table)) activeByTable.set(ord.table, ord);
        }
      }
      if (activeByTable.size > 0) {
        tables = tables.map((t) => {
          const activeOrd = activeByTable.get(t.id);
          if (activeOrd) {
            return {
              ...t,
              status: activeOrd.status === "Served" ? "Billing" : "Occupied",
              orderId: activeOrd.id,
              customerName: activeOrd.customer,
              customerPhone: activeOrd.phone,
            };
          }
          return t;
        });
      }
    }

    // 7. Resolve Inventory
    if (fetchedInv.length > 0) {
      inventory = fetchedInv.map((i: any) => ({
        id: i.id,
        name: i.name,
        category: i.category_name || "Provisions",
        unit: i.unit_of_measure || "kg",
        stock: Number(i.total_global_on_hand ?? i.qty_on_hand ?? 50),
        par: Number(i.reorder_level || 20),
        costPerUnit: Number(i.standard_cost || 100),
        supplier: "Global Commissary",
        daysLeft: 10,
      }));
    }

    // 8. Resolve Reservations (mapping table UUID -> display table code)
    if (fetchedRes.length > 0) {
      reservations = fetchedRes.map((r: any) => ({
        id: r.id,
        name: r.customer_name,
        phone: r.customer_phone,
        guests: r.covers,
        time: new Date(r.reserved_from).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        date: new Date(r.reserved_from).toISOString().slice(0, 10),
        table: (r.table_id && (tableUuidToCode.get(String(r.table_id)) || resolveTableCode(String(r.table_id)))) || "none",
        status: r.status === "confirmed" ? "Confirmed" : r.status === "seated" ? "Seated" : "Pending",
        occasion: r.occasion,
      }));
    }

    // 9. Asynchronously sync active Recipes (BOM) for fetched menu items
    if (menuItems.length > 0) {
      const invById = new Map<string, InventoryItem>();
      inventory.forEach((inv) => invById.set(inv.id, inv));
      void Promise.allSettled(
        menuItems.slice(0, 40).map((m) =>
          menuService.listRecipes(m.id).then((resList) => ({ menuItem: m, resList }))
        )
      ).then((results) => {
        const liveRecipes: Recipe[] = [];
        for (const r of results) {
          if (r.status === "fulfilled" && Array.isArray(r.value.resList) && r.value.resList.length > 0) {
            const activeRec: any = r.value.resList.find((x: any) => x.is_active) || r.value.resList[0];
            const lines: any[] = activeRec?.lines || [];
            if (lines.length > 0) {
              const ingredients = lines.map((ln: any) => {
                const invItem = invById.get(String(ln.inventory_item_id));
                return {
                  inventoryId: String(ln.inventory_item_id),
                  name: invItem?.name || ln.ingredient_name || "Ingredient",
                  qty: Number(ln.qty_per_unit || ln.qty || 0.1),
                  unit: ln.uom || invItem?.unit || "kg",
                };
              });
              const totalCost = ingredients.reduce((sum, ing) => {
                const invItem = invById.get(ing.inventoryId);
                return sum + ing.qty * (invItem?.costPerUnit || 100);
              }, 0);
              liveRecipes.push({
                itemId: r.value.menuItem.id,
                itemName: r.value.menuItem.name,
                ingredients,
                cost: Math.round(totalCost),
                prepInstructions: activeRec.notes || `Standard BOM recipe for ${r.value.menuItem.name}`,
              });
            }
          }
        }
        if (liveRecipes.length > 0) {
          recipes = liveRecipes;
          emit();
        }
      });
    }

    emit();
  } catch (err) {
    console.error("Failed to sync restaurantStore from PostgreSQL:", err);
  }
}

// Auto-trigger sync on load and when organization/tenant/branch switches
if (typeof window !== "undefined") {
  void initRestaurantStore();
  const handleOrgOrBranchChange = () => {
    void initRestaurantStore();
  };
  window.addEventListener("bos-tenant-changed", handleOrgOrBranchChange);
  window.addEventListener("bos-company-changed", handleOrgOrBranchChange);
  window.addEventListener("bos-auth-changed", handleOrgOrBranchChange);
}

// Initial Suppliers
const suppliers: Supplier[] = [
  {
    id: "SUP-01",
    name: "Venky's Fresh",
    category: "Meat & Poultry",
    contactPerson: "Kishore Kumar",
    phone: "+91 98490 11223",
    email: "orders@venkysfresh.com",
    deliveryDays: ["Daily (Morning)"],
  },
  {
    id: "SUP-02",
    name: "India Gate Wholesale",
    category: "Grains & Rice",
    contactPerson: "Harpreet Singh",
    phone: "+91 98850 44556",
    email: "supply@indiagatewholesale.in",
    deliveryDays: ["Tue", "Fri"],
  },
  {
    id: "SUP-03",
    name: "Heritage Dairy",
    category: "Dairy",
    contactPerson: "M. Venkat Rao",
    phone: "+91 97000 88990",
    email: "distributor@heritagedairy.com",
    deliveryDays: ["Daily"],
  },
  {
    id: "SUP-04",
    name: "Bowenpally Market",
    category: "Fresh Vegetables",
    contactPerson: "Ramulu Goud",
    phone: "+91 99080 77112",
    email: "ramulu.veggies@gmail.com",
    deliveryDays: ["Daily (05:00)"],
  },
  {
    id: "SUP-05",
    name: "Metro Cash & Carry",
    category: "Oils, Flour & Dry Goods",
    contactPerson: "Accounts Desk",
    phone: "+91 40 4030 2000",
    email: "b2b.hyd@metro.co.in",
    deliveryDays: ["Mon", "Wed", "Sat"],
  },
  {
    id: "SUP-06",
    name: "Amul Distributor",
    category: "Dairy & Butter",
    contactPerson: "S. N. Sharma",
    phone: "+91 98123 66778",
    email: "amul.hyderabad@gmail.com",
    deliveryDays: ["Mon", "Thu"],
  },
  {
    id: "SUP-07",
    name: "Blue Tokai",
    category: "Coffee & Beverages",
    contactPerson: "Priya S.",
    phone: "+91 99890 33445",
    email: "roasters@bluetokai.com",
    deliveryDays: ["Weekly (Mon)"],
  },
  {
    id: "SUP-08",
    name: "Spice Route",
    category: "Specialty Spices & Saffron",
    contactPerson: "Farooq Baig",
    phone: "+91 90000 99887",
    email: "farooq@spiceroutehyd.com",
    deliveryDays: ["Bi-weekly"],
  },
];

// Initial Recipes linking menu items to inventory items (overwritten by live BOM recipes on sync)
let recipes: Recipe[] = [
  {
    itemId: "M10", // Chicken Biryani
    itemName: "Chicken Biryani",
    ingredients: [
      { inventoryId: "I01", name: "Chicken (curry cut)", qty: 0.25, unit: "kg" },
      { inventoryId: "I02", name: "Basmati Rice", qty: 0.15, unit: "kg" },
      { inventoryId: "I03", name: "Cooking Oil", qty: 0.03, unit: "L" },
      { inventoryId: "I06", name: "Onion", qty: 0.08, unit: "kg" },
      { inventoryId: "I12", name: "Saffron", qty: 0.05, unit: "g" },
    ],
    cost: 84,
    prepInstructions:
      "Marinate chicken with curd and spices. Layer with parboiled basmati rice and dum cook for 25 min.",
  },
  {
    itemId: "M01", // Paneer Tikka
    itemName: "Paneer Tikka",
    ingredients: [
      { inventoryId: "I04", name: "Paneer", qty: 0.18, unit: "kg" },
      { inventoryId: "I08", name: "Butter", qty: 0.02, unit: "kg" },
      { inventoryId: "I07", name: "Tomato", qty: 0.05, unit: "kg" },
    ],
    cost: 68,
    prepInstructions:
      "Cube paneer, marinate in spiced yoghurt, skewer with peppers and onion, roast in tandoor.",
  },
  {
    itemId: "M06", // Butter Chicken
    itemName: "Butter Chicken",
    ingredients: [
      { inventoryId: "I01", name: "Chicken (curry cut)", qty: 0.25, unit: "kg" },
      { inventoryId: "I07", name: "Tomato", qty: 0.15, unit: "kg" },
      { inventoryId: "I08", name: "Butter", qty: 0.04, unit: "kg" },
      { inventoryId: "I10", name: "Milk", qty: 0.05, unit: "L" },
    ],
    cost: 112,
    prepInstructions:
      "Char chicken in tandoor, simmer gently in rich velvety makhani tomato butter gravy.",
  },
  {
    itemId: "M07", // Dal Makhani
    itemName: "Dal Makhani",
    ingredients: [
      { inventoryId: "I08", name: "Butter", qty: 0.03, unit: "kg" },
      { inventoryId: "I07", name: "Tomato", qty: 0.08, unit: "kg" },
      { inventoryId: "I10", name: "Milk", qty: 0.05, unit: "L" },
    ],
    cost: 40,
    prepInstructions:
      "Slow-simmer black urad lentils overnight with butter, ginger, garlic and fresh tomato puree.",
  },
  {
    itemId: "M13", // Butter Naan
    itemName: "Butter Naan",
    ingredients: [
      { inventoryId: "I09", name: "Maida", qty: 0.1, unit: "kg" },
      { inventoryId: "I08", name: "Butter", qty: 0.015, unit: "kg" },
      { inventoryId: "I10", name: "Milk", qty: 0.02, unit: "L" },
    ],
    cost: 9,
    prepInstructions:
      "Leaven dough, slap inside tandoor clay wall, glaze generously with softened white butter.",
  },
  {
    itemId: "M18", // Cold Coffee
    itemName: "Cold Coffee",
    ingredients: [
      { inventoryId: "I10", name: "Milk", qty: 0.25, unit: "L" },
      { inventoryId: "I11", name: "Coffee Beans", qty: 0.015, unit: "kg" },
    ],
    cost: 36,
    prepInstructions:
      "Fresh espresso shot blended with chilled milk and premium artisanal vanilla ice cream.",
  },
];

// Initial Purchase Orders
let purchaseOrders: PurchaseOrder[] = [
  {
    id: "PO-101",
    poNumber: "PO-2026-081",
    supplier: "Venky's Fresh",
    status: "Sent",
    total: 9600,
    createdAt: Date.now() - 4 * 3600_000,
    items: [
      { inventoryId: "I01", name: "Chicken (curry cut)", qty: 40, unit: "kg", costPerUnit: 240 },
    ],
  },
  {
    id: "PO-102",
    poNumber: "PO-2026-082",
    supplier: "Heritage Dairy",
    status: "Draft",
    total: 5700,
    createdAt: Date.now() - 2 * 3600_000,
    items: [{ inventoryId: "I04", name: "Paneer", qty: 15, unit: "kg", costPerUnit: 380 }],
  },
  {
    id: "PO-103",
    poNumber: "PO-2026-079",
    supplier: "India Gate Wholesale",
    status: "Received",
    total: 9440,
    createdAt: Date.now() - 24 * 3600_000,
    receivedAt: Date.now() - 5 * 3600_000,
    items: [{ inventoryId: "I02", name: "Basmati Rice", qty: 80, unit: "kg", costPerUnit: 118 }],
  },
];

// Initial Staff Shifts
const todayStr = new Date().toISOString().slice(0, 10);
let staffShifts: StaffShift[] = [
  {
    id: "SH-01",
    staffId: "S01",
    staffName: "Ananya Rao",
    role: "Branch Manager",
    date: todayStr,
    shift: "10:00–22:00",
    clockIn: "09:55",
    status: "On shift",
  },
  {
    id: "SH-02",
    staffId: "S02",
    staffName: "Chef Imran Qureshi",
    role: "Head Chef",
    date: todayStr,
    shift: "11:00–23:00",
    clockIn: "10:48",
    status: "On shift",
  },
  {
    id: "SH-03",
    staffId: "S03",
    staffName: "Ravi Teja",
    role: "Captain",
    date: todayStr,
    shift: "12:00–21:00",
    clockIn: "11:58",
    status: "On shift",
  },
  {
    id: "SH-04",
    staffId: "S04",
    staffName: "Sneha Patil",
    role: "Server",
    date: todayStr,
    shift: "12:00–21:00",
    clockIn: "12:02",
    status: "On shift",
  },
  {
    id: "SH-05",
    staffId: "S05",
    staffName: "Arjun Das",
    role: "Server",
    date: todayStr,
    shift: "16:00–23:30",
    clockIn: "15:50",
    status: "On shift",
  },
  {
    id: "SH-06",
    staffId: "S06",
    staffName: "Kavya Nair",
    role: "Cashier",
    date: todayStr,
    shift: "10:00–18:00",
    clockIn: "09:50",
    status: "On shift",
  },
  {
    id: "SH-07",
    staffId: "S07",
    staffName: "Mohammed Rafi",
    role: "Tandoor Chef",
    date: todayStr,
    shift: "12:00–23:00",
    clockIn: "11:45",
    status: "On shift",
  },
  {
    id: "SH-08",
    staffId: "S08",
    staffName: "Suresh Babu",
    role: "Line Cook",
    date: todayStr,
    shift: "07:00–15:00",
    clockIn: "06:55",
    clockOut: "15:05",
    status: "Completed",
  },
  {
    id: "SH-09",
    staffId: "S09",
    staffName: "Divya Krishnan",
    role: "Host",
    date: todayStr,
    shift: "17:00–23:00",
    status: "Scheduled",
  },
];

// Initial Payments recorded from completed/paid orders
let payments: Payment[] = [
  {
    id: "PAY-1001",
    orderId: "ORD-1040",
    amount: 1058,
    method: "UPI",
    timestamp: Date.now() - 8 * 60_000,
    customer: "Sanjay Gupta",
    transactionRef: "UPI-428192841029",
  },
  {
    id: "PAY-1002",
    orderId: "ORD-1039",
    amount: 400,
    method: "Card",
    timestamp: Date.now() - 17 * 60_000,
    customer: "Fatima Khan",
    transactionRef: "TXN-881920",
  },
  {
    id: "PAY-1003",
    orderId: "ORD-1037",
    amount: 588,
    method: "Wallet",
    timestamp: Date.now() - 1 * 60_000,
    customer: "Swiggy #88213",
    transactionRef: "SWG-88213-PAY",
  },
  {
    id: "PAY-1004",
    orderId: "ORD-1036",
    amount: 462,
    method: "UPI",
    timestamp: Date.now() - 94 * 60_000,
    customer: "Zomato #55102",
    transactionRef: "ZOM-55102-PAY",
  },
];

let orderSeq = 1046;
let paymentSeq = 1005;
let poSeq = 104;

// Reactive listener setup
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// ==========================================
// 2. REACTIVE STORE HOOKS
// ==========================================

export const useOrders = () =>
  useSyncExternalStore(
    subscribe,
    () => orders,
    () => orders,
  );
export const useTables = () =>
  useSyncExternalStore(
    subscribe,
    () => tables,
    () => tables,
  );
export const useReservations = () =>
  useSyncExternalStore(
    subscribe,
    () => reservations,
    () => reservations,
  );
export const useMenu = () =>
  useSyncExternalStore(
    subscribe,
    () => menuItems,
    () => menuItems,
  );
export const useInventory = () =>
  useSyncExternalStore(
    subscribe,
    () => inventory,
    () => inventory,
  );
export const useCustomers = () =>
  useSyncExternalStore(
    subscribe,
    () => customers,
    () => customers,
  );
export const useStaff = () =>
  useSyncExternalStore(
    subscribe,
    () => staff,
    () => staff,
  );
export const useStaffShifts = () =>
  useSyncExternalStore(
    subscribe,
    () => staffShifts,
    () => staffShifts,
  );
export const usePayments = () =>
  useSyncExternalStore(
    subscribe,
    () => payments,
    () => payments,
  );
export const useSuppliers = () =>
  useSyncExternalStore(
    subscribe,
    () => suppliers,
    () => suppliers,
  );
export const usePurchaseOrders = () =>
  useSyncExternalStore(
    subscribe,
    () => purchaseOrders,
    () => purchaseOrders,
  );
export const useRecipes = () =>
  useSyncExternalStore(
    subscribe,
    () => recipes,
    () => recipes,
  );
export const useSettings = () =>
  useSyncExternalStore(
    subscribe,
    () => settings,
    () => settings,
  );

// Non-React synchronous getters & subscription
export const getOrders = () => orders;
export const getTables = () => tables;
export const getReservations = () => reservations;
export const getMenuItems = () => menuItems;
export const getInventory = () => inventory;
export const getCustomers = () => customers;
export const getStaff = () => staff;
export const getStaffShifts = () => staffShifts;
export const getPayments = () => payments;
export const getSuppliers = () => suppliers;
export const getPurchaseOrders = () => purchaseOrders;
export const getRecipes = () => recipes;
export const getSettings = () => settings;
export const subscribeToStore = subscribe;

// ==========================================
// 3. ACTIONS & WORKFLOW INTEGRATIONS
// ==========================================

// Helper: Deplete inventory based on ordered items & recipes (BOM)
function deductRecipeIngredients(lines: OrderLine[], orderRefId?: string) {
  const deductions: Record<string, number> = {};
  for (const line of lines) {
    const rec = recipes.find(
      (r) => r.itemId === line.itemId || r.itemName.toLowerCase() === line.name.toLowerCase()
    );
    if (rec) {
      for (const ing of rec.ingredients) {
        deductions[ing.inventoryId] = (deductions[ing.inventoryId] ?? 0) + ing.qty * line.qty;
      }
    }
  }

  if (Object.keys(deductions).length > 0) {
    inventory = inventory.map((inv) => {
      const deduction = deductions[inv.id];
      if (deduction !== undefined) {
        const newStock = Math.max(0, Math.round((inv.stock - deduction) * 100) / 100);
        const dailyBurn = Math.max(1, inv.par / 7);
        const newDaysLeft = Math.max(0, Math.round((newStock / dailyBurn) * 10) / 10);
        return {
          ...inv,
          stock: newStock,
          daysLeft: newDaysLeft,
        };
      }
      return inv;
    });

    // Asynchronously consume stock from the backend Restaurant Kitchen Sub-Inventory per org/outlet
    const outletUuid = resolveActiveOutletId();
    for (const [invId, qty] of Object.entries(deductions)) {
      if (!isValidUuid(invId)) continue;
      inventoryService
        .consumeStock({
          outlet_id: outletUuid,
          inventory_item_id: invId,
          module: "restaurant",
          qty,
          reference_type: "pos_dish_prep",
          reference_id: isValidUuid(orderRefId) ? orderRefId : undefined,
          notes: "Kitchen order dish recipe BOM consumption",
        })
        .catch(() => {
          // Non-blocking in frontend store
        });
    }
  }
}

// POST /orders
export function createOrder(input: {
  type: OrderType;
  table?: string;
  customer: string;
  phone?: string;
  lines: OrderLine[];
  paid: boolean;
  paymentMethod?: PaymentMethod;
  backendBillId?: string;
  billNumber?: string;
}): Order {
  const localId = `ORD-${orderSeq++}`;
  const order: Order = {
    id: localId,
    backendBillId: input.backendBillId,
    billNumber: input.billNumber,
    status: input.paid ? "Completed" : "New",
    createdAt: Date.now(),
    waiter: input.type === "Dine-in" ? "Ananya" : "Counter",
    type: input.type,
    table: input.table,
    customer: input.customer,
    phone: input.phone,
    lines: input.lines,
    paid: input.paid,
  };

  orders = [order, ...orders];

  // 1. Table assignment
  if (input.table) {
    tables = tables.map((t) =>
      t.id === input.table
        ? {
            ...t,
            status: input.paid ? "Cleaning" : "Occupied",
            orderId: input.paid ? undefined : order.id,
            guests: t.guests ?? (input.type === "Dine-in" ? 2 : 1),
            seatedMins: 0,
            waiter: "Ananya",
            customerName: input.customer,
            customerPhone: input.phone,
          }
        : t,
    );
  }

  // 2. Inventory ingredient deductions (BOM)
  deductRecipeIngredients(input.lines);

  // 3. Customer loyalty points and visits
  const matchingCust = customers.find(
    (c) =>
      c.name.toLowerCase() === input.customer.toLowerCase() ||
      (input.phone && c.phone === input.phone),
  );
  if (matchingCust) {
    const orderSum = input.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const addedPoints = Math.round(orderSum * 0.1);
    customers = customers.map((c) =>
      c.id === matchingCust.id
        ? {
            ...c,
            visits: c.visits + 1,
            spend: c.spend + (input.paid ? orderSum : 0),
            points: c.points + (input.paid ? addedPoints : 0),
            lastVisit: "Today",
          }
        : c,
    );
  }

  // 4. Record payment if paid
  if (input.paid) {
    const rawSum = input.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const tax = Math.round(rawSum * settings.taxRate);
    const service = input.type === "Dine-in" ? Math.round(rawSum * settings.serviceCharge) : 0;
    const totalAmount = rawSum + tax + service;

    recordPayment({
      orderId: order.id,
      amount: totalAmount,
      method: input.paymentMethod ?? "UPI",
      customer: input.customer,
      table: input.table,
    });
  }

  // 5. Persist directly to PostgreSQL via POS, Organization, and Kitchen microservices
  const outletUuid = resolveActiveOutletId();
  const tableUuid = resolveTableUuid(input.table);
  const validLines = input.lines
    .filter((l) => isValidUuid(l.itemId))
    .map((l) => ({
      menu_item_id: l.itemId,
      quantity: l.qty,
      notes: l.note,
    }));

  if (validLines.length > 0) {
    posService
      .createOrder({
        outlet_id: outletUuid,
        order_type: (input.type === "Dine-in"
          ? "dine_in"
          : input.type === "Takeaway"
            ? "takeaway"
            : "delivery") as any,
        table_id: tableUuid,
        covers: input.type === "Dine-in" ? 2 : 1,
        customer_name: input.customer,
        customer_phone: input.phone,
        lines: validLines,
      })
      .then((createdPosOrder) => {
        if (createdPosOrder?.id) {
          orders = orders.map((o) =>
            o.id === localId
              ? {
                  ...o,
                  backendId: createdPosOrder.id,
                }
              : o
          );
          if (input.paid) {
            posService.settleOrder(createdPosOrder.id).catch(() => {});
          }
          emit();
        }
      })
      .catch((err) => {
        console.warn("Could not persist order to PostgreSQL POS database:", err);
      });
  }

  if (tableUuid) {
    organizationService
      .setTableStatus(tableUuid, input.paid ? "cleaning" : "occupied")
      .catch((err) => console.warn("Could not update table status in PostgreSQL:", err));
  }

  // 6. Create KOT in kitchen database if a valid station exists (or resolve station first)
  const ensureAndFireKot = async () => {
    try {
      if (!activeStationUuid) {
        const stList = await kitchenService.getStations(outletUuid);
        if (Array.isArray(stList) && stList.length > 0 && stList[0]) {
          activeStationUuid = stList[0].id;
        }
      }
      if (!activeStationUuid) return;
      const createdKot = await kitchenService.createKOT({
        outlet_id: outletUuid,
        table_name: input.table,
        station_id: activeStationUuid,
        covers: input.type === "Dine-in" ? 2 : 1,
        order_type: input.type === "Dine-in" ? "dine_in" : "takeaway",
        items: input.lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          notes: l.note,
        })),
      });
      if (createdKot?.id) {
        orders = orders.map((o) => (o.id === localId ? { ...o, backendKotId: createdKot.id } : o));
        emit();
      }
    } catch (err) {
      console.warn("Could not create KOT in kitchen database:", err);
    }
  };
  void ensureAndFireKot();

  emit();
  return order;
}

// PATCH /orders/{id}/status
export function setOrderStatus(id: string, status: OrderStatus) {
  const o = orders.find((x) => x.id === id || x.backendId === id);
  orders = orders.map((ord) => (ord.id === id || ord.backendId === id ? { ...ord, status } : ord));

  // If order status is served and it is dine-in, table transitions to Billing
  if (status === "Served" && o?.table) {
    tables = tables.map((t) =>
      t.id === o.table && t.status === "Occupied" ? { ...t, status: "Billing" } : t,
    );
    const tableUuid = resolveTableUuid(o.table);
    if (tableUuid) {
      organizationService.setTableStatus(tableUuid, "billed").catch(() => {});
    }
  }

  // If order is cancelled on a dine-in table, release the table to Available
  if (status === "Cancelled" && o?.table) {
    tables = tables.map((t) =>
      t.id === o.table
        ? {
            ...t,
            status: "Available",
            orderId: undefined,
            guests: undefined,
            seatedMins: undefined,
          }
        : t
    );
    const tableUuid = resolveTableUuid(o.table);
    if (tableUuid) {
      organizationService.setTableStatus(tableUuid, "available").catch(() => {});
    }
  }

  // Sync status transition to POS & Kitchen KDS microservices in PostgreSQL
  if (o?.backendId && isValidUuid(o.backendId)) {
    if (status === "Cancelled") {
      posService.cancelOrder(o.backendId, "Cancelled from Orders/KDS").catch(() => {});
    } else if (status === "Preparing") {
      posService.updateOrderStatus(o.backendId, "preparing").catch(() => {});
    } else if (status === "Ready") {
      posService.updateOrderStatus(o.backendId, "ready").catch(() => {});
    } else if (status === "Served") {
      posService.updateOrderStatus(o.backendId, "served").catch(() => {});
    } else if (status === "Completed") {
      posService.settleOrder(o.backendId).catch(() => {});
    }
  }

  if (o?.backendKotId && isValidUuid(o.backendKotId)) {
    if (status === "Preparing") {
      kitchenService.markAcknowledged(o.backendKotId).catch(() => {});
    } else if (status === "Ready") {
      kitchenService.markReady(o.backendKotId).catch(() => {});
    } else if (status === "Served") {
      kitchenService.markServed(o.backendKotId).catch(() => {});
    }
  }

  emit();
}

// POST /orders/{id}/settle
export function settleOrder(id: string, paymentMethod: PaymentMethod = "Cash") {
  const o = orders.find((x) => x.id === id || x.backendId === id);
  if (!o) return;

  orders = orders.map((x) =>
    x.id === id || x.backendId === id ? { ...x, paid: true, status: "Completed" } : x
  );

  // Release table to Cleaning in memory + PostgreSQL
  if (o.table) {
    tables = tables.map((t) =>
      t.id === o.table
        ? {
            id: t.id,
            backendId: t.backendId,
            name: t.name,
            code: t.code,
            area: t.area,
            seats: t.seats,
            shape: t.shape,
            posX: t.posX,
            posY: t.posY,
            status: "Cleaning",
          }
        : t,
    );
    const tableUuid = resolveTableUuid(o.table);
    if (tableUuid) {
      organizationService.setTableStatus(tableUuid, "cleaning").catch(() => {});
    }
  }

  // Record payment
  const subtotal = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = Math.round(subtotal * settings.taxRate);
  const service = o.type === "Dine-in" ? Math.round(subtotal * settings.serviceCharge) : 0;
  const total = subtotal + tax + service;

  recordPayment({
    orderId: o.id,
    amount: total,
    method: paymentMethod,
    customer: o.customer,
    table: o.table,
  });

  // Update customer loyalty
  const matchingCust = customers.find((c) => c.name.toLowerCase() === o.customer.toLowerCase());
  if (matchingCust) {
    const pts = Math.round(total * 0.1);
    customers = customers.map((c) =>
      c.id === matchingCust.id
        ? {
            ...c,
            spend: c.spend + total,
            points: c.points + pts,
            lastVisit: "Today",
          }
        : c,
    );
  }

  // Persist settlement to POS & Billing microservices in PostgreSQL
  if (o.backendId && isValidUuid(o.backendId)) {
    posService.settleOrder(o.backendId).catch(() => {});
  }

  if (!o.backendBillId) {
    const outletUuid = resolveActiveOutletId();
    const validBillItems = o.lines
      .filter((l) => isValidUuid(l.itemId))
      .map((l) => ({
        menu_item_id: l.itemId,
        name: l.name,
        qty: l.qty,
        unit_price: l.unitPrice,
      }));
    if (validBillItems.length > 0) {
      billingService
        .createBill({
          outlet_id: outletUuid,
          order_id: isValidUuid(o.backendId) ? o.backendId : undefined,
          order_number: o.id,
          customer_name: o.customer,
          customer_phone: o.phone,
          covers: 2,
          items: validBillItems,
          service_charge_pct: o.type === "Dine-in" ? settings.serviceCharge * 100 : 0,
        })
        .then(async (bill) => {
          const methodLower = paymentMethod.toLowerCase() as "cash" | "card" | "upi" | "wallet";
          const settled = await billingService.settleBill(bill.id, {
            payments: [{ method: methodLower, amount: bill.grand_total }],
          });
          orders = orders.map((ord) =>
            ord.id === o.id
              ? {
                  ...ord,
                  backendBillId: settled.id,
                  billNumber: settled.bill_number,
                }
              : ord
          );
          emit();
        })
        .catch((err) => {
          console.warn("Could not persist bill settlement to billing microservice:", err);
        });
    }
  }

  emit();
}

// POST /payments
export function recordPayment(input: {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  customer: string;
  table?: string;
  transactionRef?: string;
}): Payment {
  const payment: Payment = {
    id: `PAY-${paymentSeq++}`,
    orderId: input.orderId,
    amount: input.amount,
    method: input.method,
    timestamp: Date.now(),
    customer: input.customer,
    table: input.table,
    transactionRef:
      input.transactionRef ??
      `${input.method.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
  };

  payments = [payment, ...payments];
  emit();
  return payment;
}

// PATCH /tables/{id}
export function setTableStatus(id: string, status: RestaurantTable["status"]) {
  const tableUuid = resolveTableUuid(id);
  tables = tables.map((t) => {
    if (t.id === id || t.backendId === id) {
      if (status === "Available" || status === "Cleaning") {
        return {
          id: t.id,
          backendId: t.backendId,
          name: t.name,
          code: t.code,
          area: t.area,
          seats: t.seats,
          shape: t.shape,
          posX: t.posX,
          posY: t.posY,
          status,
        };
      }
      return { ...t, status };
    }
    return t;
  });
  emit();

  if (tableUuid) {
    organizationService.setTableStatus(tableUuid, toBackendTableStatus(status)).catch((e) => {
      console.warn("Could not sync table status to backend:", e);
    });
  }
}

// Table seating helper (Petpooja workflow)
export function seatTable(
  tableId: string,
  guests: number,
  customerName: string,
  waiter: string = "Ananya",
  customerPhone?: string,
) {
  const tableUuid = resolveTableUuid(tableId);
  tables = tables.map((t) =>
    t.id === tableId || t.backendId === tableId
      ? {
          ...t,
          status: "Occupied",
          guests,
          customerName,
          customerPhone,
          seatedMins: 0,
          waiter,
        }
      : t,
  );
  emit();

  if (tableUuid) {
    organizationService.setTableStatus(tableUuid, "occupied").catch(() => {});
  }
}

// Reserve table helper (Petpooja workflow)
export function reserveTable(
  tableId: string,
  customerName: string,
  guests: number,
  timeStr: string = "07:30 PM",
  customerPhone?: string,
) {
  const tableUuid = resolveTableUuid(tableId);
  tables = tables.map((t) =>
    t.id === tableId || t.backendId === tableId
      ? {
          ...t,
          status: "Reserved",
          guests,
          customerName,
          customerPhone,
        }
      : t,
  );
  emit();

  if (tableUuid) {
    organizationService.setTableStatus(tableUuid, "reserved").catch(() => {});
  }
  void timeStr;
}

// Add new custom table (Floor Plan Designer)
export function addTable(newTable: Partial<RestaurantTable>): RestaurantTable {
  const tableNumber = newTable.id || `T${tables.length + 1}`;
  const t: RestaurantTable = {
    id: tableNumber,
    code: tableNumber,
    name: newTable.name || `Table ${tableNumber}`,
    area: newTable.area || "Main Hall",
    seats: newTable.seats || 4,
    shape: newTable.shape || "round",
    status: newTable.status || "Available",
    posX: newTable.posX ?? 50,
    posY: newTable.posY ?? 50,
    minCovers: newTable.minCovers ?? 1,
    maxCovers: newTable.maxCovers ?? (newTable.seats || 4) + 2,
  };
  tables = [...tables, t];
  emit();

  const outletUuid = resolveActiveOutletId();
  const sectionUuid = sectionsMap.get((t.area || "Main Hall").toLowerCase());
  organizationService
    .createTable({
      outlet_id: outletUuid,
      section_id: sectionUuid,
      name: t.name || tableNumber,
      code: tableNumber,
      capacity: t.seats,
      seats: t.seats,
      shape: t.shape,
      position_x: t.posX,
      position_y: t.posY,
    })
    .then((created) => {
      if (created?.id) {
        tables = tables.map((tbl) =>
          tbl.id === tableNumber ? { ...tbl, backendId: created.id } : tbl
        );
        emit();
      }
    })
    .catch((e) => console.warn("Could not persist new table to PostgreSQL:", e));

  return t;
}

// Update table configuration / physical layout
export function updateTable(tableId: string, updates: Partial<RestaurantTable>) {
  const tableUuid = resolveTableUuid(tableId);
  tables = tables.map((t) => (t.id === tableId || t.backendId === tableId ? { ...t, ...updates } : t));
  emit();

  if (tableUuid) {
    organizationService
      .updateTable(tableUuid, {
        name: updates.name,
        capacity: updates.seats,
        seats: updates.seats,
        shape: updates.shape,
        position_x: updates.posX,
        position_y: updates.posY,
        status: updates.status ? (toBackendTableStatus(updates.status) as any) : undefined,
      })
      .catch((e) => console.warn("Could not persist table update to PostgreSQL:", e));
  }
}

// Delete table
export function deleteTable(tableId: string) {
  const tableUuid = resolveTableUuid(tableId);
  tables = tables.filter((t) => t.id !== tableId && t.backendId !== tableId);
  emit();

  if (tableUuid) {
    organizationService
      .deleteTable(tableUuid)
      .catch((e) => console.warn("Could not delete table in PostgreSQL:", e));
  }
}

// Transfer table (Petpooja shift/merge)
export function transferTable(fromTableId: string, toTableId: string) {
  const source = tables.find((t) => t.id === fromTableId || t.backendId === fromTableId);
  const dest = tables.find((t) => t.id === toTableId || t.backendId === toTableId);
  if (!source || !dest) return;

  // Move order and seating to destination table
  tables = tables.map((t) => {
    if (t.id === dest.id) {
      return {
        ...t,
        status: source.status,
        guests: source.guests,
        orderId: source.orderId,
        seatedMins: source.seatedMins,
        waiter: source.waiter,
        customerName: source.customerName,
        customerPhone: source.customerPhone,
      };
    }
    if (t.id === source.id) {
      return {
        id: t.id,
        backendId: t.backendId,
        name: t.name,
        code: t.code,
        area: t.area,
        seats: t.seats,
        shape: t.shape,
        posX: t.posX,
        posY: t.posY,
        status: "Cleaning",
      };
    }
    return t;
  });

  // Also update order's table reference
  if (source.orderId) {
    orders = orders.map((o) => (o.id === source.orderId ? { ...o, table: dest.id } : o));
  }

  emit();

  const srcUuid = resolveTableUuid(fromTableId);
  const dstUuid = resolveTableUuid(toTableId);
  if (srcUuid) {
    organizationService.setTableStatus(srcUuid, "cleaning").catch(() => {});
  }
  if (dstUuid) {
    organizationService.setTableStatus(dstUuid, toBackendTableStatus(source.status)).catch(() => {});
  }
}

// ==========================================
// 4. MENU SERVICE
// ==========================================

export async function toggleMenuItemAvailability(id: string, available?: boolean) {
  const current = menuItems.find((m) => m.id === id);
  const targetAvailable = available !== undefined ? available : !current?.available;

  menuItems = menuItems.map((m) =>
    m.id === id ? { ...m, available: targetAvailable } : m,
  );
  emit();

  if (isValidUuid(id)) {
    try {
      await menuService.updateItem(id, { is_available: targetAvailable });
    } catch (e) {
      console.warn("Could not sync item availability to menu backend:", e);
    }
  }
}

export async function addMenuItem(item: Omit<MenuItem, "id">): Promise<MenuItem> {
  const tempId = `M${menuItems.length + 1}`;
  const newItem: MenuItem = {
    ...item,
    id: tempId,
  };
  menuItems = [...menuItems, newItem];
  emit();

  try {
    const cats = await menuService.getCategories();
    let backendCategory = cats.find(
      (c) => c.name.toLowerCase() === item.category.toLowerCase()
    );
    if (!backendCategory && cats.length > 0) {
      backendCategory = cats[0];
    }
    if (backendCategory) {
      const created = await menuService.createItem({
        category_id: backendCategory.id,
        name: item.name,
        code: `M${menuItems.length}`,
        description: item.description,
        base_price: item.price,
        item_type: "dish",
        is_available: item.available ?? true,
      });
      if (created?.id) {
        menuItems = menuItems.map((m) => (m.id === tempId ? { ...m, id: created.id } : m));
        emit();
        return { ...newItem, id: created.id };
      }
    }
  } catch (e) {
    console.warn("Could not sync added menu item to backend:", e);
  }

  return newItem;
}

export function updateMenuItem(id: string, updates: Partial<MenuItem>) {
  menuItems = menuItems.map((m) => (m.id === id ? { ...m, ...updates } : m));
  emit();

  if (isValidUuid(id)) {
    menuService
      .updateItem(id, {
        name: updates.name,
        description: updates.description,
        base_price: updates.price,
        is_available: updates.available,
      })
      .catch((e) => console.warn("Could not sync menu item update to backend:", e));
  }
}

export function deleteMenuItem(id: string) {
  menuItems = menuItems.filter((m) => m.id !== id);
  emit();

  if (isValidUuid(id)) {
    menuService
      .deleteItem(id)
      .catch((e) => console.warn("Could not delete menu item on backend:", e));
  }
}

// ==========================================
// 5. INVENTORY & PURCHASING SERVICE
// ==========================================

export async function adjustStock(id: string, delta: number) {
  inventory = inventory.map((item) => {
    if (item.id === id) {
      const stock = Math.max(0, Math.round((item.stock + delta) * 100) / 100);
      const burn = Math.max(1, item.par / 7);
      const daysLeft = Math.max(0, Math.round((stock / burn) * 10) / 10);
      return { ...item, stock, daysLeft };
    }
    return item;
  });
  emit();

  if (isValidUuid(id)) {
    try {
      await inventoryService.adjustStock({
        item_id: id,
        qty_delta: delta,
        reason: delta > 0 ? "manual_restock" : "waste_adjustment",
      });
    } catch (e) {
      console.warn("Could not sync stock adjustment to backend:", e);
    }
  }
}

export function createPurchaseOrder(
  supplierName: string,
  items: { inventoryId: string; qty: number }[],
): PurchaseOrder {
  const poItems = items.map((it) => {
    const inv = inventory.find((i) => i.id === it.inventoryId);
    return {
      inventoryId: it.inventoryId,
      name: inv ? inv.name : "Custom Item",
      qty: it.qty,
      unit: inv ? inv.unit : "units",
      costPerUnit: inv ? inv.costPerUnit : 100,
    };
  });

  const total = poItems.reduce((s, it) => s + it.qty * it.costPerUnit, 0);

  const po: PurchaseOrder = {
    id: `PO-${poSeq++}`,
    poNumber: `PO-2026-${String(poSeq).padStart(3, "0")}`,
    supplier: supplierName,
    status: "Sent",
    items: poItems,
    total,
    createdAt: Date.now(),
  };

  purchaseOrders = [po, ...purchaseOrders];
  emit();
  return po;
}

export function receivePurchaseOrder(poId: string) {
  const po = purchaseOrders.find((p) => p.id === poId);
  if (!po || po.status === "Received") return;

  // Add stock to inventory
  for (const item of po.items) {
    void adjustStock(item.inventoryId, item.qty);
  }

  purchaseOrders = purchaseOrders.map((p) =>
    p.id === poId ? { ...p, status: "Received", receivedAt: Date.now() } : p,
  );
  emit();
}

export function autoGenerateCriticalPOs(): PurchaseOrder[] {
  // Find critical or low items (< 50% par)
  const lowItems = inventory.filter((i) => i.stock / i.par < 0.5);
  const bySupplier = new Map<string, InventoryItem[]>();

  for (const item of lowItems) {
    const existing = bySupplier.get(item.supplier);
    if (existing) {
      existing.push(item);
    } else {
      bySupplier.set(item.supplier, [item]);
    }
  }

  const created: PurchaseOrder[] = [];
  for (const [supplier, items] of bySupplier.entries()) {
    const po = createPurchaseOrder(
      supplier,
      items.map((i) => ({ inventoryId: i.id, qty: Math.max(5, Math.ceil(i.par - i.stock)) })),
    );
    created.push(po);
  }

  return created;
}

// ==========================================
// 6. CUSTOMER & LOYALTY SERVICE
// ==========================================

export function addCustomer(
  cust: Omit<Customer, "id" | "visits" | "spend" | "lastVisit" | "tier" | "points">,
): Customer {
  const newCust: Customer = {
    id: `C${String(customers.length + 1).padStart(3, "0")}`,
    ...cust,
    visits: 0,
    spend: 0,
    lastVisit: "—",
    tier: "Bronze",
    points: 100, // Welcome bonus
    favourite: "—",
    tags: ["New"],
  };
  customers = [newCust, ...customers];
  emit();
  return newCust;
}

export function awardPoints(customerId: string, points: number) {
  customers = customers.map((c) => (c.id === customerId ? { ...c, points: c.points + points } : c));
  emit();
}

// ==========================================
// 7. RESERVATION SERVICE
// ==========================================

export function createReservation(res: Omit<Reservation, "id" | "status">): Reservation {
  const newRes: Reservation = {
    id: `RSV-${308 + reservations.length}`,
    status: "Confirmed",
    ...res,
  };

  reservations = [...reservations, newRes];

  // If table is assigned, mark table as Reserved
  if (res.table && res.table !== "none") {
    tables = tables.map((t) => (t.id === res.table ? { ...t, status: "Reserved" } : t));
    const tableUuid = resolveTableUuid(res.table);
    if (tableUuid) {
      organizationService.setTableStatus(tableUuid, "reserved").catch((e) => {
        console.warn("Could not sync reservation table status to backend:", e);
      });
    }
  }

  emit();
  return newRes;
}

export function updateReservationStatus(id: string, status: Reservation["status"]) {
  const r = reservations.find((x) => x.id === id);
  reservations = reservations.map((x) => (x.id === id ? { ...x, status } : x));

  if (status === "Cancelled" && r?.table && r.table !== "none") {
    tables = tables.map((t) =>
      t.id === r.table && t.status === "Reserved" ? { ...t, status: "Available" } : t,
    );
    const tableUuid = resolveTableUuid(r.table);
    if (tableUuid) {
      organizationService.setTableStatus(tableUuid, "available").catch((e) => {
        console.warn("Could not sync cancelled table status to backend:", e);
      });
    }
  }

  emit();
}

export function seatReservation(id: string, targetTable?: string) {
  const r = reservations.find((x) => x.id === id);
  if (!r) return;

  const tableToSeat = targetTable ?? r.table;
  reservations = reservations.map((x) =>
    x.id === id ? { ...x, status: "Seated", table: tableToSeat } : x,
  );

  if (tableToSeat && tableToSeat !== "none") {
    tables = tables.map((t) =>
      t.id === tableToSeat
        ? {
            ...t,
            status: "Occupied",
            guests: r.guests,
            customerName: r.name,
            customerPhone: r.phone,
            seatedMins: 0,
            waiter: "Ananya",
          }
        : t,
    );
    const tableUuid = resolveTableUuid(tableToSeat);
    if (tableUuid) {
      organizationService.setTableStatus(tableUuid, "occupied").catch((e) => {
        console.warn("Could not sync seated table status to backend:", e);
      });
    }
  }

  emit();
}

// ==========================================
// 8. STAFF & ATTENDANCE SERVICE
// ==========================================

export function updateStaffStatus(id: string, status: StaffMember["status"]) {
  staff = staff.map((s) => (s.id === id ? { ...s, status } : s));
  staffShifts = staffShifts.map((sh) =>
    sh.staffId === id
      ? {
          ...sh,
          status: status === "On shift" ? "On shift" : status === "Off" ? "Completed" : sh.status,
        }
      : sh,
  );
  emit();
}

export function clockInStaff(staffId: string) {
  const nowTime = new Date().toTimeString().slice(0, 5);
  staff = staff.map((s) => (s.id === staffId ? { ...s, status: "On shift" } : s));
  staffShifts = staffShifts.map((sh) =>
    sh.staffId === staffId ? { ...sh, clockIn: nowTime, status: "On shift" } : sh,
  );
  emit();
}

export function clockOutStaff(staffId: string) {
  const nowTime = new Date().toTimeString().slice(0, 5);
  staff = staff.map((s) => (s.id === staffId ? { ...s, status: "Off" } : s));
  staffShifts = staffShifts.map((sh) =>
    sh.staffId === staffId ? { ...sh, clockOut: nowTime, status: "Completed" } : sh,
  );
  emit();
}

export function addStaffMember(newStaff: Omit<StaffMember, "id">): StaffMember {
  const s: StaffMember = {
    id: `S${String(staff.length + 1).padStart(2, "0")}`,
    ...newStaff,
  };
  staff = [...staff, s];
  emit();
  return s;
}

// ==========================================
// 9. SETTINGS SERVICE (Persisted Per Org & Outlet)
// ==========================================

export function updateSettings(updates: Partial<RestaurantSettings>) {
  settings = { ...settings, ...updates };
  emit();

  // Keep the organization's receipt template header defaults aligned
  updateReceiptTemplate(
    {
      brandName: settings.name,
      orgName: settings.name,
      subtitle: settings.tagline,
      tagline: settings.tagline,
      branchName: settings.currentBranch,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      gstin: settings.gstin,
      fssai: settings.fssai,
    },
    { persistBackend: true }
  );

  // Persist outlet details to PostgreSQL organization service
  const outletUuid = resolveActiveOutletId();
  if (isValidUuid(outletUuid)) {
    organizationService
      .updateOutlet(outletUuid, {
        name: settings.currentBranch || settings.name,
        phone: settings.phone,
        address: settings.address,
      })
      .catch((e) => console.warn("Could not persist outlet settings to backend:", e));
  }
}

export function switchBranch(branch: string) {
  settings = { ...settings, currentBranch: branch };
  const branchInfo = outletsMap.get(branch);
  if (branchInfo?.id && isValidUuid(branchInfo.id)) {
    activeOutletUuid = branchInfo.id;
    setActiveOutlet(branchInfo.id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(
        "bos-branch",
        JSON.stringify({ id: branchInfo.id, name: branchInfo.name, code: branchInfo.name })
      );
    }
    void initRestaurantStore();
  }
  emit();
}

// ==========================================
// 10. REAL-TIME AI ENGINE
// ==========================================

export interface GeneratedAiInsight {
  id: string;
  kind: "Inventory" | "Demand" | "Revenue" | "Operations" | "Customer";
  title: string;
  text: string;
  actionLabel: string;
  run: () => void;
  severity: "critical" | "warning" | "info" | "success";
}

export function getLiveAiInsights(): GeneratedAiInsight[] {
  const insights: GeneratedAiInsight[] = [];

  // 1. Inventory checks
  const lowItems = inventory.filter((i) => i.stock / i.par < 0.35);
  if (lowItems.length > 0) {
    const names = lowItems
      .map((i) => i.name)
      .slice(0, 3)
      .join(", ");
    insights.push({
      id: "ai-inv-low",
      kind: "Inventory",
      title: "Stock Alert",
      text: `${lowItems.length} item(s) below safety par: ${names}. Stockout likely before dinner peak.`,
      actionLabel: "Auto-raise POs",
      run: () => {
        autoGenerateCriticalPOs();
      },
      severity: "critical",
    });
  }

  // 2. Kitchen / Order bottleneck check
  const prepOrders = orders.filter((o) => o.status === "Preparing");
  if (prepOrders.length >= 2) {
    insights.push({
      id: "ai-kitchen-rush",
      kind: "Demand",
      title: "Kitchen Load Surge",
      text: `${prepOrders.length} tickets actively cooking. Tandoor and Biryani stations approaching peak throughput.`,
      actionLabel: "View Kitchen KDS",
      run: () => {},
      severity: "warning",
    });
  }

  // 3. Table turnover check
  const cleaningTables = tables.filter((t) => t.status === "Cleaning");
  if (cleaningTables.length >= 2) {
    insights.push({
      id: "ai-table-turnover",
      kind: "Operations",
      title: "Table Clearance Bottleneck",
      text: `${cleaningTables.length} tables (${cleaningTables.map((t) => t.id).join(", ")}) awaiting sanitization while walk-in covers queue.`,
      actionLabel: "Mark All Clean",
      run: () => {
        cleaningTables.forEach((t) => setTableStatus(t.id, "Available"));
      },
      severity: "info",
    });
  }

  // 4. Customer retention check
  const atRisk = customers.filter((c) => c.tier === "Gold" || c.tier === "Platinum").slice(0, 2);
  if (atRisk.length > 0) {
    insights.push({
      id: "ai-crm-offer",
      kind: "Customer",
      title: "High-Value Member Retention",
      text: `${atRisk.map((c) => c.name).join(" & ")} have high lifetime spend. Recommend sending weekend 15% incentive.`,
      actionLabel: "Award 200 Loyalty Points",
      run: () => {
        atRisk.forEach((c) => awardPoints(c.id, 200));
      },
      severity: "success",
    });
  }

  return insights;
}
