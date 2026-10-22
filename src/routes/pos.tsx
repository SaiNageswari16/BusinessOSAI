import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PosLeftSidebar } from "@/components/pos/PosLeftSidebar";
import { PosMenuCenter } from "@/components/pos/PosMenuCenter";
import {
  CustomerSelectorModal,
  CustomizeLineModal,
  CustomItemModal,
  DiscountModal,
  KotPreviewModal,
  PaymentModal,
  TableOperationsModal,
  TableSelectorModal,
} from "@/components/pos/PosModals";
import { PosOrderPanel } from "@/components/pos/PosOrderPanel";
import type { PosDietaryFilters } from "@/components/pos/pos-config";
import { ReceiptModal } from "@/components/shared/ReceiptModal";
import { totals } from "@/lib/calc";
import { type ComboItem, useRestaurantStore } from "@/lib/store";
import type { Kot, MenuItem, Order, OrderLine } from "@/lib/types";

export const Route = createFileRoute("/pos")({
  component: PosScreen,
});

const INITIAL_FILTERS: PosDietaryFilters = {
  dietary: "all",
  jainOnly: false,
  glutenFreeOnly: false,
  availableOnly: false,
  stationFilter: "all",
};

function PosScreen() {
  const navigate = useNavigate();

  const tables = useRestaurantStore((s) => s.tables);
  const menu = useRestaurantStore((s) => s.menu);
  const combos = useRestaurantStore((s) => s.combos);
  const customers = useRestaurantStore((s) => s.customers);
  const orders = useRestaurantStore((s) => s.orders);
  const kots = useRestaurantStore((s) => s.kots);
  const held = useRestaurantStore((s) => s.held);
  const settings = useRestaurantStore((s) => s.settings);
  const posDraft = useRestaurantStore((s) => s.posDraft);

  const setPosOrderType = useRestaurantStore((s) => s.setPosOrderType);
  const setPosTable = useRestaurantStore((s) => s.setPosTable);
  const setPosCustomer = useRestaurantStore((s) => s.setPosCustomer);
  const setPosGuests = useRestaurantStore((s) => s.setPosGuests);
  const setPosDiscount = useRestaurantStore((s) => s.setPosDiscount);
  const setPosProvider = useRestaurantStore((s) => s.setPosProvider);
  const setPosNote = useRestaurantStore((s) => s.setPosNote);
  const addToPosCart = useRestaurantStore((s) => s.addToPosCart);
  const addComboToPosCart = useRestaurantStore((s) => s.addComboToPosCart);
  const addCustomItemToPosCart = useRestaurantStore((s) => s.addCustomItemToPosCart);
  const updatePosLineQty = useRestaurantStore((s) => s.updatePosLineQty);
  const updatePosLineDetails = useRestaurantStore((s) => s.updatePosLineDetails);
  const removePosLine = useRestaurantStore((s) => s.removePosLine);
  const clearPosCart = useRestaurantStore((s) => s.clearPosCart);
  const holdPosOrder = useRestaurantStore((s) => s.holdPosOrder);
  const resumeHeldOrder = useRestaurantStore((s) => s.resumeHeldOrder);
  const deleteHeldOrder = useRestaurantStore((s) => s.deleteHeldOrder);
  const submitPosOrder = useRestaurantStore((s) => s.submitPosOrder);
  const openPosForOrder = useRestaurantStore((s) => s.openPosForOrder);
  const requestBill = useRestaurantStore((s) => s.requestBill);
  const completePayment = useRestaurantStore((s) => s.completePayment);
  const saveCustomer = useRestaurantStore((s) => s.saveCustomer);
  const transferTable = useRestaurantStore((s) => s.transferTable);
  const mergeTables = useRestaurantStore((s) => s.mergeTables);

  // Center & Left Navigation State
  const [activeCategory, setActiveCategory] = useState<string>("Bestsellers");
  const [focusedSingleCategory, setFocusedSingleCategory] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<PosDietaryFilters>(INITIAL_FILTERS);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(["M1", "M14", "M22"]);

  // Modals State
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [tableOpsMode, setTableOpsMode] = useState<"transfer" | "merge" | "more" | null>(null);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
  const [kotPreview, setKotPreview] = useState<{
    orderId: string;
    tableLabel: string;
    kots: Kot[];
  } | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const selectedTable = tables.find((t) => t.id === posDraft.tableId);
  const selectedCustomer = customers.find((c) => c.id === posDraft.customerId);

  const activeOrder = useMemo(() => {
    if (posDraft.editingOrderId) {
      return orders.find((o) => o.id === posDraft.editingOrderId);
    }
    if (posDraft.orderType === "dine-in" && posDraft.tableId) {
      return orders.find(
        (o) =>
          o.tableId === posDraft.tableId &&
          o.payment === "unpaid" &&
          o.status !== "completed" &&
          o.status !== "cancelled",
      );
    }
    return undefined;
  }, [orders, posDraft.editingOrderId, posDraft.orderType, posDraft.tableId]);

  const recentOrders = useMemo(() => {
    return [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  }, [orders]);

  const cartQtyByItem = useMemo(() => {
    const map = new Map<string, number>();
    posDraft.lines.forEach((l) => {
      map.set(l.itemId, (map.get(l.itemId) ?? 0) + l.qty);
    });
    return map;
  }, [posDraft.lines]);

  const bill = useMemo(
    () => totals(posDraft.lines, posDraft.discountPct, settings.gstPct),
    [posDraft.lines, posDraft.discountPct, settings.gstPct],
  );

  // Handlers
  const handleQuickAdd = (item: MenuItem) => {
    const res = addToPosCart(item, 1);
    if (!res.ok) {
      toast.error(res.error ?? "Cannot add item");
    } else {
      toast.success(`Added ${item.name}`);
    }
  };

  const handleAddCombo = (combo: ComboItem) => {
    const res = addComboToPosCart(combo);
    if (!res.ok) {
      toast.error(res.error ?? "Cannot add combo");
    } else {
      toast.success(`Added ${combo.name} combo`);
    }
  };

  const handleToggleFavorite = (itemId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  const handleSelectCategory = (categoryId: string) => {
    if (categoryId === "Bestsellers" && activeCategory === "Bestsellers") {
      setFocusedSingleCategory((prev) => !prev);
      return;
    }
    setActiveCategory(categoryId);
    setFocusedSingleCategory(categoryId !== "Bestsellers");
  };

  const handleViewAllCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    setFocusedSingleCategory(true);
  };

  const handleSaveOrder = () => {
    const res = submitPosOrder();
    if (!res.ok) {
      toast.error(res.error ?? "Unable to save order");
      return;
    }
    toast.success(`Saved Order ${res.orderId} (${posDraft.lines.length} items)`);
  };

  const handleHoldOrder = () => {
    const res = holdPosOrder();
    if (!res.ok) {
      toast.error(res.error ?? "Unable to hold order");
      return;
    }
    toast.info(`Order parked as ${res.heldId}`);
  };

  const handlePrintKot = () => {
    const tableLabel =
      posDraft.orderType === "dine-in"
        ? `Table ${posDraft.tableId ?? "T2"}`
        : posDraft.orderType.toUpperCase();
    const res = submitPosOrder();
    if (!res.ok || !res.orderId) {
      toast.error(res.error ?? "Failed to dispatch KOT");
      return;
    }
    const latestKots = useRestaurantStore
      .getState()
      .kots.filter((k) => (res.kotIds ?? []).includes(k.id));
    setKotPreview({
      orderId: res.orderId,
      tableLabel,
      kots: latestKots,
    });
    toast.success(`KOT dispatched for ${res.orderId}`);
  };

  const handleProceedToPayment = () => {
    if (posDraft.lines.length === 0) {
      toast.error("Add items to the order before proceeding to payment.");
      return;
    }
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = (method: string, nextTableStatus: "available" | "cleaning") => {
    let targetOrderId = activeOrder?.id;
    if (!targetOrderId) {
      const sub = submitPosOrder();
      if (!sub.ok || !sub.orderId) {
        toast.error(sub.error ?? "Could not create order for billing");
        return;
      }
      targetOrderId = sub.orderId;
    }

    requestBill(targetOrderId);
    const payRes = completePayment(targetOrderId, method, posDraft.discountPct, nextTableStatus);
    if (!payRes.ok) {
      toast.error(payRes.error ?? "Payment failed");
      return;
    }

    const updatedOrder = useRestaurantStore.getState().orders.find((o) => o.id === targetOrderId);
    setPaymentModalOpen(false);
    if (updatedOrder) {
      setReceiptOrder(updatedOrder);
    }
    toast.success(`Payment completed for ${targetOrderId} via ${method}`);
  };

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-108px)] bg-[#F4F7FC] px-3.5 py-3 sm:-mx-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 lg:flex-row lg:items-start">
        {/* LEFT PANEL: Order Type, Table, Guests, Customer, Categories, Custom Item */}
        <PosLeftSidebar
          posDraft={posDraft}
          selectedTable={selectedTable}
          selectedCustomer={selectedCustomer}
          activeCategory={activeCategory}
          onSelectOrderType={setPosOrderType}
          onOpenTableSelector={() => setTableModalOpen(true)}
          onChangeGuests={setPosGuests}
          onClearCustomer={() => setPosCustomer(undefined)}
          onOpenCustomerSelector={() => setCustomerModalOpen(true)}
          onSelectCategory={handleSelectCategory}
          onOpenCustomItemModal={() => setCustomItemModalOpen(true)}
          onSelectProvider={(prov) => setPosProvider(prov)}
        />

        {/* CENTER PANEL: Featured Special Banner, Search & Dietary Filters, Dish Sections */}
        <PosMenuCenter
          menu={menu}
          combos={combos}
          activeCategory={activeCategory}
          focusedSingleCategory={focusedSingleCategory}
          featuredIndex={featuredIndex}
          searchQuery={searchQuery}
          filters={filters}
          favoriteIds={favoriteIds}
          cartQtyByItem={cartQtyByItem}
          onChangeFeaturedIndex={setFeaturedIndex}
          onChangeSearchQuery={setSearchQuery}
          onUpdateFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onResetFilters={() => {
            setSearchQuery("");
            setFilters(INITIAL_FILTERS);
            setActiveCategory("Bestsellers");
            setFocusedSingleCategory(false);
          }}
          onToggleFavorite={handleToggleFavorite}
          onQuickAdd={handleQuickAdd}
          onOpenCustomize={(item) => {
            setEditingLine(null);
            setCustomizingItem(item);
          }}
          onAddCombo={handleAddCombo}
          onViewAllCategory={handleViewAllCategory}
          onExitSingleCategory={() => {
            setActiveCategory("Bestsellers");
            setFocusedSingleCategory(false);
            setSearchQuery("");
          }}
        />

        {/* RIGHT PANEL: Persistent Current Order, Bill Summary & Checkout */}
        <PosOrderPanel
          posDraft={posDraft}
          selectedTable={selectedTable}
          activeOrder={activeOrder}
          recentOrders={recentOrders}
          held={held}
          gstPct={settings.gstPct}
          maxDiscountPct={settings.maxDiscountPct}
          onUpdateLineQty={updatePosLineQty}
          onRemoveLine={removePosLine}
          onEditLine={(line) => {
            setCustomizingItem(null);
            setEditingLine(line);
          }}
          onChangeNote={setPosNote}
          onChangeDiscount={(pct) => {
            const ok = setPosDiscount(pct);
            if (!ok) {
              toast.error(`Discount must be between 0% and ${settings.maxDiscountPct}%`);
            }
          }}
          onOpenDiscountDialog={() => setDiscountModalOpen(true)}
          onOpenTableSelector={() => setTableModalOpen(true)}
          onOpenTransferModal={() => setTableOpsMode("transfer")}
          onOpenMergeModal={() => setTableOpsMode("merge")}
          onOpenMoreActionsModal={() => setTableOpsMode("more")}
          onSaveOrder={handleSaveOrder}
          onHoldOrder={handleHoldOrder}
          onPrintKot={handlePrintKot}
          onProceedToPayment={handleProceedToPayment}
          onResumeHeldOrder={(heldId) => {
            resumeHeldOrder(heldId);
            toast.success(`Resumed held order ${heldId}`);
          }}
          onDeleteHeldOrder={(heldId) => {
            deleteHeldOrder(heldId);
            toast.info(`Removed held order ${heldId}`);
          }}
          onLoadOrderIntoPos={(orderId) => {
            openPosForOrder(orderId);
            toast.success(`Loaded order ${orderId} into POS`);
          }}
          onViewOrderReceipt={(ord) => setReceiptOrder(ord)}
        />
      </div>

      {/* MODALS */}
      <TableSelectorModal
        open={tableModalOpen}
        onOpenChange={setTableModalOpen}
        tables={tables}
        selectedTableId={posDraft.tableId}
        onSelectTable={(tblId) => {
          setPosTable(tblId);
          toast.success(`Switched POS to Table ${tblId}`);
        }}
      />

      <CustomerSelectorModal
        open={customerModalOpen}
        onOpenChange={setCustomerModalOpen}
        customers={customers}
        selectedCustomerId={posDraft.customerId}
        onSelectCustomer={(custId) => setPosCustomer(custId)}
        onCreateCustomer={(cust) => saveCustomer(cust)}
      />

      <CustomItemModal
        open={customItemModalOpen}
        onOpenChange={setCustomItemModalOpen}
        onAddCustomItem={(input) => addCustomItemToPosCart(input)}
      />

      <CustomizeLineModal
        open={customizingItem !== null || editingLine !== null}
        item={customizingItem}
        editingLine={editingLine}
        onClose={() => {
          setCustomizingItem(null);
          setEditingLine(null);
        }}
        onConfirm={({ qty, modifiers, addons, note }) => {
          if (editingLine) {
            updatePosLineQty(editingLine.lineId, qty);
            updatePosLineDetails(editingLine.lineId, { modifiers, addons, note });
            toast.success(`Updated ${editingLine.name}`);
            setEditingLine(null);
            return;
          }
          if (customizingItem) {
            const res = addToPosCart(customizingItem, qty, modifiers, addons, note);
            if (!res.ok) {
              toast.error(res.error ?? "Unable to add item");
              return;
            }
            toast.success(`Added ${qty}× ${customizingItem.name}`);
            setCustomizingItem(null);
          }
        }}
      />

      <DiscountModal
        open={discountModalOpen}
        onOpenChange={setDiscountModalOpen}
        currentDiscountPct={posDraft.discountPct}
        maxDiscountPct={settings.maxDiscountPct}
        subtotal={bill.subtotal}
        onApplyDiscount={(pct) => setPosDiscount(pct)}
      />

      <TableOperationsModal
        mode={tableOpsMode}
        onClose={() => setTableOpsMode(null)}
        currentTable={selectedTable}
        tables={tables}
        onTransfer={(toTableId) => {
          if (!posDraft.tableId) return;
          const res = transferTable(posDraft.tableId, toTableId);
          if (!res.ok) {
            toast.error(res.error ?? "Transfer failed");
            return;
          }
          setPosTable(toTableId);
          toast.success(`Transferred order to Table ${toTableId}`);
        }}
        onMerge={(secondaryTableId) => {
          if (!posDraft.tableId) return;
          const res = mergeTables(posDraft.tableId, secondaryTableId);
          if (!res.ok) {
            toast.error(res.error ?? "Merge failed");
            return;
          }
          setPosTable(posDraft.tableId);
          toast.success(`Merged Table ${secondaryTableId} into Table ${posDraft.tableId}`);
        }}
        onClearCart={() => {
          clearPosCart();
          toast.info("Cleared current order cart");
        }}
      />

      {kotPreview && (
        <KotPreviewModal
          open={kotPreview !== null}
          onOpenChange={(open) => {
            if (!open) setKotPreview(null);
          }}
          orderId={kotPreview.orderId}
          tableLabel={kotPreview.tableLabel}
          kots={kotPreview.kots}
          note={posDraft.note}
          onNavigateKitchen={() => navigate({ to: "/kot" })}
        />
      )}

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        posDraft={posDraft}
        gstPct={settings.gstPct}
        onConfirmPayment={handleConfirmPayment}
      />

      <ReceiptModal
        order={receiptOrder}
        open={receiptOrder !== null}
        onOpenChange={(open) => {
          if (!open) setReceiptOrder(null);
        }}
      />
    </div>
  );
}
