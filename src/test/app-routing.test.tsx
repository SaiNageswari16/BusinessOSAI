import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { beforeEach, describe, expect, it } from "vitest";

import {
  getNavBadgeValue,
  isNavItemActive,
  NAV_ITEMS_CONFIG,
} from "@/components/layout/nav-config";
import {
  calculateRecipeCost,
  exportMenuToCsv,
  filterAndSortMenuItems,
  getMenuAddons,
  getMenuCategoryDisplay,
  getMenuDisplayName,
  getMenuItemTypeDisplay,
  getMenuModifiers,
  getMenuPrepTimeMins,
  getMenuServingSize,
  getMenuTags,
  MENU_SIDEBAR_CATEGORIES,
  validateMenuItemForm,
} from "@/components/menu/menu-utils";
import {
  loadCustomFloorBackgrounds,
  materializeCanvasTables,
  resolveTableCanvasPosition,
  saveCustomFloorBackground,
  validateFloorPlanFile,
} from "@/components/operations/operations-utils";
import {
  computeOrdersKpiSummary,
  deriveDisplayOrderStatus,
  deriveKitchenStatus,
  exportOrdersToCsv,
} from "@/components/orders/orders-utils";
import {
  getItemsForPosCategory,
  matchesPosFilters,
  POS_CATEGORIES,
} from "@/components/pos/pos-config";
import { orderTotal, tableCounts, totals } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import { routeTree } from "@/routeTree.gen";

describe("RestaurantOS routing & end-to-end workflow verification", () => {
  beforeEach(() => {
    useRestaurantStore.getState().resetDemoData();
  });

  it("matches all required application routes without falling back to root 404", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    const requiredRoutes = [
      "/",
      "/dashboard",
      "/operations",
      "/pos",
      "/orders",
      "/kot",
      "/kitchen",
      "/kds",
      "/menu",
      "/inventory",
      "/reservations",
      "/crm",
      "/staff",
      "/delivery",
      "/reports",
      "/ai",
      "/settings",
    ];

    for (const path of requiredRoutes) {
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });

  it("loads the exact seeded Sunrise Restaurant dataset", () => {
    const state = useRestaurantStore.getState();
    expect(state.settings.restaurant).toBe("Sunrise Restaurant");
    expect(state.settings.branch).toBe("Hyderabad Central");
    expect(state.settings.gstPct).toBe(5);
    expect(state.tables).toHaveLength(16);
    expect(state.menu).toHaveLength(43);
    expect(state.customers).toHaveLength(28);
    expect(state.ingredients).toHaveLength(32);
    expect(state.staff).toHaveLength(17);
    expect(state.reservations).toHaveLength(18);
  });

  it("completes the full Table -> POS -> KOT/KDS -> Bill -> Payment -> Receipt workflow", () => {
    const store = useRestaurantStore.getState();

    // 1. Select available table T1 in Operations & open POS
    const tableBefore = store.tables.find((t) => t.id === "T1")!;
    expect(tableBefore.status).toBe("available");
    store.openPosForTable("T1");
    store.setPosCustomer("C1");

    // 2. Add Paneer Tikka (M1) with modifier & add-on, and Butter Naan (M28)
    const paneerTikka = store.menu.find((m) => m.id === "M1")!;
    const butterNaan = store.menu.find((m) => m.id === "M28")!;
    const paneerIngBefore = store.ingredients.find((i) => i.name === "Paneer")!.stock;

    const add1 = useRestaurantStore
      .getState()
      .addToPosCart(
        paneerTikka,
        2,
        ["Extra spicy"],
        [{ name: "Mint Chutney", price: 20 }],
        "Crisp",
      );
    const add2 = useRestaurantStore.getState().addToPosCart(butterNaan, 3);
    expect(add1.ok).toBe(true);
    expect(add2.ok).toBe(true);

    // 3. Submit order to kitchen
    const submitRes = useRestaurantStore.getState().submitPosOrder();
    expect(submitRes.ok).toBe(true);
    const orderId = submitRes.orderId!;
    expect(orderId).toBeDefined();
    expect(submitRes.kotIds?.length).toBeGreaterThan(0);

    // 4. Verify order, table status, KOT creation, and single stock deduction
    let current = useRestaurantStore.getState();
    const createdOrder = current.orders.find((o) => o.id === orderId)!;
    expect(createdOrder.status).toBe("in-kitchen");
    expect(createdOrder.payment).toBe("unpaid");
    expect(createdOrder.stockDeducted).toBe(true);

    const occupiedTable = current.tables.find((t) => t.id === "T1")!;
    expect(occupiedTable.status).toBe("occupied");
    expect(occupiedTable.orderId).toBe(orderId);

    const paneerIngAfter = current.ingredients.find((i) => i.name === "Paneer")!.stock;
    expect(paneerIngAfter).toBeLessThan(paneerIngBefore);

    // 5. KDS: Start preparing and mark all KOTs ready
    const orderKots = current.kots.filter((k) => k.orderId === orderId);
    expect(orderKots.length).toBeGreaterThan(0);
    for (const kot of orderKots) {
      useRestaurantStore.getState().updateKotStatus(kot.id, "preparing");
      useRestaurantStore.getState().updateKotStatus(kot.id, "ready");
    }

    current = useRestaurantStore.getState();
    expect(current.orders.find((o) => o.id === orderId)?.status).toBe("ready");

    // 6. Generate bill & complete payment
    useRestaurantStore.getState().requestBill(orderId);
    expect(useRestaurantStore.getState().tables.find((t) => t.id === "T1")?.status).toBe("billing");

    const payRes = useRestaurantStore.getState().completePayment(orderId, "UPI", 10);
    expect(payRes.ok).toBe(true);

    current = useRestaurantStore.getState();
    const paidOrder = current.orders.find((o) => o.id === orderId)!;
    expect(paidOrder.status).toBe("completed");
    expect(paidOrder.payment).toBe("paid");
    expect(paidOrder.paymentMethod).toBe("UPI");
    expect(paidOrder.discountPct).toBe(10);
    expect(orderTotal(paidOrder, current.settings.gstPct)).toBeGreaterThan(0);
    expect(current.tables.find((t) => t.id === "T1")?.status).toBe("available");
  });

  it("connects menu availability, PO goods receipt, and profile switching without data loss", () => {
    const store = useRestaurantStore.getState();
    const initialOrderCount = store.orders.length;

    // Toggle menu availability blocks POS addition
    store.toggleMenuAvailability("M1");
    const unavailableItem = useRestaurantStore.getState().menu.find((m) => m.id === "M1")!;
    expect(unavailableItem.available).toBe(false);
    const resAdd = useRestaurantStore.getState().addToPosCart(unavailableItem, 1);
    expect(resAdd.ok).toBe(false);

    // Receive PO-2101 increases Mutton stock
    const muttonBefore = useRestaurantStore
      .getState()
      .ingredients.find((i) => i.name === "Mutton")!.stock;
    const poRes = useRestaurantStore.getState().receivePurchaseOrder("PO-2101");
    expect(poRes.ok).toBe(true);
    const muttonAfter = useRestaurantStore
      .getState()
      .ingredients.find((i) => i.name === "Mutton")!.stock;
    expect(muttonAfter).toBe(muttonBefore + 10);

    // Switching restaurant profiles preserves all orders
    useRestaurantStore.getState().setProfile("cloud-kitchen");
    expect(useRestaurantStore.getState().settings.profile).toBe("cloud-kitchen");
    expect(useRestaurantStore.getState().orders.length).toBe(initialOrderCount);
  });

  it("verifies all 14 header navigation items, active route highlighting, badge counts, and theme switching", () => {
    expect(NAV_ITEMS_CONFIG).toHaveLength(14);

    const dashboardItem = NAV_ITEMS_CONFIG.find((i) => i.key === "dashboard")!;
    const kitchenItem = NAV_ITEMS_CONFIG.find((i) => i.key === "kitchen")!;
    const ordersItem = NAV_ITEMS_CONFIG.find((i) => i.key === "orders")!;

    expect(isNavItemActive(dashboardItem, "/")).toBe(true);
    expect(isNavItemActive(dashboardItem, "/dashboard")).toBe(true);
    expect(isNavItemActive(dashboardItem, "/pos")).toBe(false);

    expect(isNavItemActive(kitchenItem, "/kot")).toBe(true);
    expect(isNavItemActive(kitchenItem, "/kds")).toBe(true);
    expect(isNavItemActive(ordersItem, "/orders")).toBe(true);

    const counts = { orders: 13, kitchen: 16, inventory: 7, delivery: 3 };
    expect(getNavBadgeValue("orders", counts)).toBe(13);
    expect(getNavBadgeValue("kitchen", counts)).toBe(16);
    expect(getNavBadgeValue("inventory", counts)).toBe(7);
    expect(getNavBadgeValue("delivery", counts)).toBe(3);

    // Theme toggle & branch selector state verification
    expect(useRestaurantStore.getState().settings.dark).toBe(false);
    useRestaurantStore.getState().toggleDark();
    expect(useRestaurantStore.getState().settings.dark).toBe(true);

    useRestaurantStore.getState().setBranch("Jubilee Hills");
    expect(useRestaurantStore.getState().settings.branch).toBe("Jubilee Hills");
  });

  it("verifies Operations Floor Plan filters, KPI counts, billing -> cleaning -> available lifecycle, and layout editor persistence", () => {
    const initialTables = useRestaurantStore.getState().tables;
    const initialCounts = tableCounts(initialTables);
    expect(initialCounts.available).toBe(5);
    expect(initialCounts.occupied).toBe(5);
    expect(initialCounts.reserved).toBe(3);
    expect(initialCounts.billing).toBe(1);
    expect(initialCounts.cleaning).toBe(2);
    expect(
      initialCounts.available +
        initialCounts.occupied +
        initialCounts.reserved +
        initialCounts.billing +
        initialCounts.cleaning,
    ).toBe(16);

    // Area filtering check
    const mainHallTables = initialTables.filter((t) => t.area === "Main Hall");
    const terraceTables = initialTables.filter((t) => t.area === "Terrace");
    const privateRoomTables = initialTables.filter((t) => t.area === "Private Room");
    expect(mainHallTables).toHaveLength(12);
    expect(terraceTables).toHaveLength(2);
    expect(privateRoomTables).toHaveLength(2);

    // Verify T6 is Billing with #ORD-1042 totaling ₹1,260
    const billingTable = initialTables.find((t) => t.id === "T6")!;
    expect(billingTable.status).toBe("billing");
    expect(billingTable.orderId).toBe("ORD-1042");
    const ord1042 = useRestaurantStore.getState().orders.find((o) => o.id === "ORD-1042")!;
    expect(orderTotal(ord1042, 5)).toBe(1260);

    const payToCleaningRes = useRestaurantStore
      .getState()
      .completePayment("ORD-1042", "Card", 0, "cleaning");
    expect(payToCleaningRes.ok).toBe(true);

    const afterPayTable = useRestaurantStore
      .getState()
      .tables.find((t) => t.id === billingTable.id)!;
    expect(afterPayTable.status).toBe("cleaning");
    expect(afterPayTable.orderId).toBeUndefined();

    // Mark cleaned table back to Available
    useRestaurantStore.getState().setTableStatus(billingTable.id, "available");
    expect(useRestaurantStore.getState().tables.find((t) => t.id === billingTable.id)?.status).toBe(
      "available",
    );

    // Floor-plan layout editor: materialize, drag T1, add T13, save layout, and verify persistence
    const draft = materializeCanvasTables(useRestaurantStore.getState().tables).map((t) =>
      t.id === "T1" ? { ...t, x: 0.24, y: 0.31, shape: "rect" as const, scale: 1.15 } : t,
    );
    useRestaurantStore.getState().saveTablesLayout(draft);

    const savedT1 = useRestaurantStore.getState().tables.find((t) => t.id === "T1")!;
    const resolvedT1 = resolveTableCanvasPosition(savedT1, useRestaurantStore.getState().tables);
    expect(resolvedT1.x).toBe(0.24);
    expect(resolvedT1.y).toBe(0.31);
    expect(savedT1.shape).toBe("rect");
    expect(savedT1.scale).toBe(1.15);

    // Add a new table in Edit Layout / Store
    const addRes = useRestaurantStore.getState().addDiningTable({
      name: "T13",
      area: "Main Hall",
      capacity: 6,
      shape: "round",
      x: 0.52,
      y: 0.48,
    });
    expect(addRes.ok).toBe(true);
    expect(useRestaurantStore.getState().tables).toHaveLength(17);

    // Prevent deleting a table that has an active unpaid order
    const occupiedTbl = useRestaurantStore
      .getState()
      .tables.find((t) => t.status === "occupied" && t.orderId)!;
    const blockedDelete = useRestaurantStore.getState().deleteDiningTable(occupiedTbl.id);
    expect(blockedDelete.ok).toBe(false);

    // Allow deleting the newly added available table T13
    const allowedDelete = useRestaurantStore.getState().deleteDiningTable("T13");
    expect(allowedDelete.ok).toBe(true);
    expect(useRestaurantStore.getState().tables).toHaveLength(16);

    // Floor-plan background image validation & separate storage
    const validPng = new File(["dummy"], "floor.png", { type: "image/png" });
    const invalidTxt = new File(["dummy"], "notes.txt", { type: "text/plain" });
    expect(validateFloorPlanFile(validPng).ok).toBe(true);
    expect(validateFloorPlanFile(invalidTxt).ok).toBe(false);

    saveCustomFloorBackground("Main Hall", "data:image/png;base64,iVBORw0KGgo=");
    expect(loadCustomFloorBackgrounds()["Main Hall"]).toBe("data:image/png;base64,iVBORw0KGgo=");
    // Verify custom background upload did not reset T1's saved coordinates
    expect(useRestaurantStore.getState().tables.find((t) => t.id === "T1")?.x).toBe(0.24);
  });

  it("verifies POS default Table T2 order state, category & dietary filtering, custom items, discount & GST math, and hold/resume", () => {
    const state = useRestaurantStore.getState();

    // 1. Default POS state matches Table T2 (Ravi Kumar, 3 guests, 4 lines, 10% discount, ₹1,134 total)
    expect(state.posDraft.orderType).toBe("dine-in");
    expect(state.posDraft.tableId).toBe("T2");
    expect(state.posDraft.customerId).toBe("C1");
    expect(state.posDraft.guests).toBe(3);
    expect(state.posDraft.lines).toHaveLength(4);
    expect(state.posDraft.discountPct).toBe(10);
    expect(state.held).toHaveLength(2);

    const initialBill = totals(
      state.posDraft.lines,
      state.posDraft.discountPct,
      state.settings.gstPct,
    );
    expect(initialBill.subtotal).toBe(1200);
    expect(initialBill.discount).toBe(120);
    expect(initialBill.taxable).toBe(1080);
    expect(initialBill.gst).toBe(54);
    expect(initialBill.total).toBe(1134);

    // 2. POS Categories & dietary filtering using real item attributes
    expect(POS_CATEGORIES).toHaveLength(12);
    const bestsellers = getItemsForPosCategory("Bestsellers", state.menu);
    expect(bestsellers[0]?.name).toBe("Hyderabadi Chicken Biryani");
    expect(bestsellers[0]?.price).toBe(320);

    const jainItems = state.menu.filter((it) =>
      matchesPosFilters(it, "", {
        dietary: "veg",
        jainOnly: true,
        glutenFreeOnly: false,
        availableOnly: true,
        stationFilter: "all",
      }),
    );
    expect(jainItems.length).toBeGreaterThan(0);
    expect(jainItems.every((it) => it.veg && it.jain)).toBe(true);

    const glutenFreeItems = state.menu.filter((it) =>
      matchesPosFilters(it, "", {
        dietary: "all",
        jainOnly: false,
        glutenFreeOnly: true,
        availableOnly: true,
        stationFilter: "all",
      }),
    );
    expect(glutenFreeItems.length).toBeGreaterThan(0);
    expect(glutenFreeItems.every((it) => it.glutenFree)).toBe(true);

    // 3. Custom Item validation & addition without mutating permanent menu
    const menuCountBefore = useRestaurantStore.getState().menu.length;
    const badCustom = useRestaurantStore.getState().addCustomItemToPosCart({
      name: "   ",
      price: 150,
    });
    expect(badCustom.ok).toBe(false);

    const badPrice = useRestaurantStore.getState().addCustomItemToPosCart({
      name: "Chef Special Soup",
      price: 0,
    });
    expect(badPrice.ok).toBe(false);

    const validCustom = useRestaurantStore.getState().addCustomItemToPosCart({
      name: "Chef Special Corn Soup",
      price: 160,
      qty: 2,
      veg: true,
      station: "Curry",
      note: "Less pepper",
      saveToMenu: false,
    });
    expect(validCustom.ok).toBe(true);
    expect(useRestaurantStore.getState().menu.length).toBe(menuCountBefore);
    expect(useRestaurantStore.getState().posDraft.lines).toHaveLength(5);

    // 4. Discount validation
    expect(useRestaurantStore.getState().setPosDiscount(45)).toBe(false);
    expect(useRestaurantStore.getState().setPosDiscount(15)).toBe(true);
    expect(useRestaurantStore.getState().posDraft.discountPct).toBe(15);

    // 5. Hold order & resume held order
    const holdRes = useRestaurantStore.getState().holdPosOrder("Table T2 Hold");
    expect(holdRes.ok).toBe(true);
    expect(useRestaurantStore.getState().posDraft.lines).toHaveLength(0);
    expect(useRestaurantStore.getState().held).toHaveLength(3);

    useRestaurantStore.getState().resumeHeldOrder(holdRes.heldId!);
    expect(useRestaurantStore.getState().posDraft.lines).toHaveLength(5);
    expect(useRestaurantStore.getState().held).toHaveLength(2);
  });

  it("verifies Orders screen KPI summary cards, #ORD-1045 details, kitchen/order status derivation, discount & note updates, and CSV export", () => {
    const state = useRestaurantStore.getState();

    // 1. Verify the 7 Summary KPI Cards (28 Total: 18 Dine In, 5 Takeaway, 5 Delivery; 6 Pending, 20 Completed, 2 Cancelled)
    const kpi = computeOrdersKpiSummary(state.orders);
    expect(kpi.total).toBe(28);
    expect(kpi.dineIn).toBe(18);
    expect(kpi.dineInPct).toBe(64);
    expect(kpi.takeaway).toBe(5);
    expect(kpi.takeawayPct).toBe(18);
    expect(kpi.delivery).toBe(5);
    expect(kpi.deliveryPct).toBe(18);
    expect(kpi.pending).toBe(6);
    expect(kpi.pendingPct).toBe(21);
    expect(kpi.completed).toBe(20);
    expect(kpi.completedPct).toBe(71);
    expect(kpi.cancelled).toBe(2);
    expect(kpi.cancelledPct).toBe(7);

    // 2. Verify top order #ORD-1045 details (4 items, 10% discount, ₹1,134 total, Special Instructions)
    const ord1045 = state.orders.find((o) => o.id === "ORD-1045")!;
    expect(ord1045).toBeDefined();
    expect(ord1045.lines).toHaveLength(4);
    expect(ord1045.discountPct).toBe(10);
    expect(ord1045.note).toBe("Less spicy, extra raita");
    expect(orderTotal(ord1045, state.settings.gstPct)).toBe(1134);
    expect(deriveDisplayOrderStatus(ord1045)).toBe("Ongoing");
    expect(deriveKitchenStatus(ord1045, state.kots)).toBe("New");

    // 3. Send #ORD-1045 to kitchen advances its KOTs to Preparing
    const sendRes = useRestaurantStore.getState().sendOrderToKitchen("ORD-1045");
    expect(sendRes.ok).toBe(true);
    expect(
      deriveKitchenStatus(
        useRestaurantStore.getState().orders.find((o) => o.id === "ORD-1045")!,
        useRestaurantStore.getState().kots,
      ),
    ).toBe("Preparing");

    // 4. Update order note & discount on #ORD-1045
    useRestaurantStore.getState().updateOrderNote("ORD-1045", "Extra raita and onion salad");
    expect(useRestaurantStore.getState().orders.find((o) => o.id === "ORD-1045")?.note).toBe(
      "Extra raita and onion salad",
    );

    const badDisc = useRestaurantStore.getState().updateOrderDiscount("ORD-1045", 50);
    expect(badDisc.ok).toBe(false);
    const goodDisc = useRestaurantStore.getState().updateOrderDiscount("ORD-1045", 0);
    expect(goodDisc.ok).toBe(true);
    expect(
      orderTotal(
        useRestaurantStore.getState().orders.find((o) => o.id === "ORD-1045")!,
        state.settings.gstPct,
      ),
    ).toBe(1260);

    // 5. Hold existing order from Orders screen & verify CSV export output
    const holdExisting = useRestaurantStore.getState().holdExistingOrder("ORD-1045");
    expect(holdExisting.ok).toBe(true);
    expect(holdExisting.heldId).toBe("HOLD-1045");

    const csv = exportOrdersToCsv(
      useRestaurantStore.getState().orders,
      state.customers,
      state.settings.gstPct,
    );
    expect(csv).toContain("#ORD-1045");
    expect(csv).toContain("Order ID,Time,Order Type,Table,Customer");
  });

  it("verifies Menu Management KPI counts, 12 showcase cards, item details metadata, add/edit/duplicate/delete workflows, and POS sync", () => {
    const state = useRestaurantStore.getState();

    // 1. Verify KPI summary card counts (43 Total Items, 12 Categories, 8 Combos, 6 Modifiers)
    expect(state.menu).toHaveLength(43);
    expect(MENU_SIDEBAR_CATEGORIES).toHaveLength(12);
    expect(state.combos).toHaveLength(8);

    // 2. Verify default All Items showcase order & exact prices for top 12 cards
    const allItems = filterAndSortMenuItems(state.menu, {
      sidebarCategory: "all",
      dropdownCategory: "all",
      availability: "all",
      dietary: "all",
      searchQuery: "",
      sortBy: "name-asc",
    });
    expect(allItems).toHaveLength(43);
    expect(getMenuDisplayName(allItems[0]!)).toBe("Chicken Biryani");
    expect(allItems[0]!.price).toBe(320);
    expect(allItems[1]!.name).toBe("Paneer Tikka");
    expect(allItems[1]!.price).toBe(280);
    expect(allItems[2]!.name).toBe("Butter Chicken");
    expect(allItems[2]!.price).toBe(340);
    expect(allItems[3]!.name).toBe("Dal Makhani");
    expect(allItems[3]!.price).toBe(220);
    expect(allItems[4]!.name).toBe("Garlic Naan");
    expect(allItems[4]!.price).toBe(60);
    expect(allItems[5]!.name).toBe("Masala Dosa");
    expect(allItems[5]!.price).toBe(180);
    expect(allItems[6]!.name).toBe("Chicken Curry");
    expect(allItems[6]!.price).toBe(300);
    expect(allItems[7]!.name).toBe("Kadai Paneer");
    expect(allItems[7]!.price).toBe(280);
    expect(allItems[8]!.name).toBe("Mutton Rogan Josh");
    expect(allItems[8]!.price).toBe(380);
    expect(allItems[9]!.name).toBe("Chilli Chicken");
    expect(allItems[9]!.price).toBe(280);
    expect(allItems[10]!.name).toBe("Veg Manchurian");
    expect(allItems[10]!.price).toBe(220);
    expect(allItems[11]!.name).toBe("Gulab Jamun");
    expect(allItems[11]!.price).toBe(120);

    // 3. Verify Right Details Panel metadata for M22 (Chicken Biryani)
    const m22 = state.menu.find((m) => m.id === "M22")!;
    expect(getMenuCategoryDisplay(m22)).toBe("Biryani & Rice");
    expect(getMenuItemTypeDisplay(m22)).toBe("Main Course");
    expect(getMenuPrepTimeMins(m22)).toBe(20);
    expect(getMenuServingSize(m22)).toBe("1 plate");
    expect(getMenuTags(m22)).toEqual(["Biryani", "Spicy", "Bestseller", "Non-Veg", "Indian"]);
    expect(getMenuModifiers(m22)).toHaveLength(3);
    expect(getMenuAddons(m22)).toHaveLength(4);
    expect(calculateRecipeCost(m22, state.ingredients).cost).toBeGreaterThan(0);

    // 4. Form validation, Add Item, Edit Item (syncs to POS), Duplicate Item, Delete Item
    expect(
      validateMenuItemForm({
        name: "",
        category: "Starters",
        price: 250,
        prepTimeMins: 15,
        servingSize: "1 plate",
      }).ok,
    ).toBe(false);

    const newId = useRestaurantStore.getState().saveMenuItem({
      name: "Nizami Mutton Haleem",
      category: "Starters",
      price: 360,
      veg: false,
      bestseller: true,
      available: true,
      station: "Curry",
      description: "Slow-cooked mutton and wheat delicacy",
      recipe: [],
    });
    expect(useRestaurantStore.getState().menu).toHaveLength(44);

    // Edit price of M1 and verify POS menu sees the updated price
    useRestaurantStore.getState().updateMenuPrice("M1", 295);
    const posStarters = getItemsForPosCategory("Starters", useRestaurantStore.getState().menu);
    expect(posStarters.find((m) => m.id === "M1")?.price).toBe(295);

    // Duplicate item
    const dupRes = useRestaurantStore.getState().duplicateMenuItem(newId);
    expect(dupRes.ok).toBe(true);
    expect(dupRes.newItem?.name).toBe("Nizami Mutton Haleem (Copy)");
    expect(useRestaurantStore.getState().menu).toHaveLength(45);

    // Delete duplicated item
    const delRes = useRestaurantStore.getState().deleteMenuItem(dupRes.newItem!.id);
    expect(delRes.ok).toBe(true);
    expect(useRestaurantStore.getState().menu).toHaveLength(44);

    // Export CSV check
    const menuCsv = exportMenuToCsv(useRestaurantStore.getState().menu);
    expect(menuCsv).toContain("Nizami Mutton Haleem");
  });
});
