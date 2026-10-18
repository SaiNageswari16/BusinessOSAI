import { describe, expect, it } from "vitest";
import {
  createOrder,
  setOrderStatus,
  settleOrder,
  setTableStatus,
  seatReservation,
  createReservation,
  createPurchaseOrder,
  receivePurchaseOrder,
  clockInStaff,
  clockOutStaff,
  updateSettings,
  getOrders,
  getTables,
  getReservations,
  getInventory,
  getPayments,
  getCustomers,
  getStaff,
  getSettings,
  getPurchaseOrders,
  subscribeToStore,
} from "@/services/restaurantStore";

describe("RestaurantOS Workflow and Reactive State", () => {
  it("completes primary workflow: POS -> Kitchen -> Serve -> Settle Payment", () => {
    let notificationCount = 0;
    const unsubscribe = subscribeToStore(() => {
      notificationCount++;
    });

    // Check table T1 (initially Available)
    const initialT1 = getTables().find((t) => t.id === "T1");
    expect(initialT1).toBeDefined();

    // Check basmati rice inventory (I02)
    const riceInvBefore = getInventory().find((i) => i.id === "I02")?.stock ?? 0;

    // 1. Create Dine-in order at T1 for customer Priya Menon with Chicken Biryani (M10)
    const createdOrder = createOrder({
      type: "Dine-in",
      table: "T1",
      customer: "Priya Menon",
      lines: [
        {
          itemId: "M10",
          name: "Chicken Biryani",
          qty: 2,
          unitPrice: 320,
          station: "Biryani",
        },
      ],
      paid: false,
    });

    expect(createdOrder.id).toBeDefined();
    expect(createdOrder.status).toBe("New");
    expect(createdOrder.table).toBe("T1");
    expect(notificationCount).toBeGreaterThan(0);

    // Table T1 should now be Occupied
    const updatedT1 = getTables().find((t) => t.id === "T1");
    expect(updatedT1?.status).toBe("Occupied");
    expect(updatedT1?.orderId).toBe(createdOrder.id);

    // Rice inventory should be deducted (2 biryanis * 0.15kg = 0.3kg)
    const riceInvAfter = getInventory().find((i) => i.id === "I02")?.stock ?? 0;
    expect(riceInvAfter).toBeLessThan(riceInvBefore);

    // 2. Kitchen KDS Progression: New -> Preparing -> Ready -> Served
    setOrderStatus(createdOrder.id, "Preparing");
    expect(getOrders().find((o) => o.id === createdOrder.id)?.status).toBe("Preparing");

    setOrderStatus(createdOrder.id, "Ready");
    expect(getOrders().find((o) => o.id === createdOrder.id)?.status).toBe("Ready");

    setOrderStatus(createdOrder.id, "Served");
    expect(getOrders().find((o) => o.id === createdOrder.id)?.status).toBe("Served");

    // Once Served, table status should transition to "Billing"
    expect(getTables().find((t) => t.id === "T1")?.status).toBe("Billing");

    // 3. Settle Payment
    const initialPaymentsCount = getPayments().length;
    const priyaBefore = getCustomers().find((c) => c.name.toLowerCase().includes("priya"));
    const priyaPointsBefore = priyaBefore?.points ?? 0;

    settleOrder(createdOrder.id, "UPI");

    // Order should now be Completed and paid
    const settledOrder = getOrders().find((o) => o.id === createdOrder.id);
    expect(settledOrder?.status).toBe("Completed");
    expect(settledOrder?.paid).toBe(true);

    // Payment record should be added
    expect(getPayments().length).toBe(initialPaymentsCount + 1);
    const recordedPayment = getPayments()[0];
    expect(recordedPayment.orderId).toBe(createdOrder.id);
    expect(recordedPayment.method).toBe("UPI");
    expect(recordedPayment.amount).toBeGreaterThan(0);

    // Table should now be released to "Cleaning"
    expect(getTables().find((t) => t.id === "T1")?.status).toBe("Cleaning");

    // Customer loyalty points should be awarded
    const priyaAfter = getCustomers().find((c) => c.name.toLowerCase().includes("priya"));
    expect(priyaAfter?.points).toBeGreaterThan(priyaPointsBefore);

    // 4. Sanitize table
    setTableStatus("T1", "Available");
    expect(getTables().find((t) => t.id === "T1")?.status).toBe("Available");

    unsubscribe();
  });

  it("handles reservations and table seating lifecycle", () => {
    // 1. Create reservation for Table T7
    const rsv = createReservation({
      name: "Vikram Malhotra",
      phone: "+91 98888 77777",
      time: "20:30",
      guests: 4,
      table: "T7",
      notes: "Anniversary dinner",
    });

    expect(rsv.id).toBeDefined();
    expect(getTables().find((t) => t.id === "T7")?.status).toBe("Reserved");

    // 2. Seat the reservation
    seatReservation(rsv.id);

    expect(getReservations().find((r) => r.id === rsv.id)?.status).toBe("Seated");
    const seatedTable = getTables().find((t) => t.id === "T7");
    expect(seatedTable?.status).toBe("Occupied");
    expect(seatedTable?.guests).toBe(4);
  });

  it("handles purchase orders and goods receipt into inventory", () => {
    const paneerStockBefore = getInventory().find((i) => i.id === "I04")?.stock ?? 0;

    // 1. Raise PO for Paneer (I04)
    const po = createPurchaseOrder("Heritage Dairy", [{ inventoryId: "I04", qty: 10 }]);

    expect(po.id).toBeDefined();
    expect(po.status).toBe("Sent");
    expect(getPurchaseOrders().find((p) => p.id === po.id)).toBeDefined();

    // 2. Receive PO (Goods Receipt)
    receivePurchaseOrder(po.id);

    expect(getPurchaseOrders().find((p) => p.id === po.id)?.status).toBe("Received");
    const paneerStockAfter = getInventory().find((i) => i.id === "I04")?.stock ?? 0;
    expect(paneerStockAfter).toBe(paneerStockBefore + 10);
  });

  it("tracks staff clock-in and clock-out attendance", () => {
    const chef = getStaff().find((s) => s.role === "Head Chef");
    expect(chef).toBeDefined();

    // Clock in
    clockInStaff(chef!.id);
    expect(getStaff().find((s) => s.id === chef!.id)?.status).toBe("On shift");

    // Clock out
    clockOutStaff(chef!.id);
    expect(getStaff().find((s) => s.id === chef!.id)?.status).toBe("Off");
  });

  it("updates settings and reactive branch selector", () => {
    updateSettings({
      tagline: "Premier Fine Dining & Craft Kitchen",
      serviceCharge: 0.08,
    });

    expect(getSettings().tagline).toBe("Premier Fine Dining & Craft Kitchen");
    expect(getSettings().serviceCharge).toBe(0.08);
  });
});
