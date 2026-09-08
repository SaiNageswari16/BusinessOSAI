import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Search, Filter, Store, User, MapPin, Calendar, Clock,
  CreditCard, Box, ExternalLink, Truck, CheckCircle2, ChevronRight,
  Package, Printer, CheckSquare, Square, AlertCircle, FileText,
  Send, RefreshCw, X, ShieldCheck, ArrowRight, Phone, Mail, Hash
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";

export function MarketplaceOrders() {
  const queryClient = useQueryClient();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [channelFilter, setChannelFilter] = useState("All");

  // Active Modals
  const [pickingOrder, setPickingOrder] = useState<any | null>(null);
  const [dispatchingOrder, setDispatchingOrder] = useState<any | null>(null);
  const [printingInvoiceOrder, setPrintingInvoiceOrder] = useState<any | null>(null);

  // Pick checklist state { [itemId]: boolean }
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});

  // Dispatch form state
  const [courierName, setCourierName] = useState("Careem Express");
  const [trackingNumber, setTrackingNumber] = useState("");

  const { data: apiOrders, isLoading, refetch } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: () => marketplaceApi.getOrders(),
    staleTime: 10000,
  });

  const packMutation = useMutation({
    mutationFn: (orderId: string) => marketplaceApi.packOrder(orderId),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Order ${orderId} packed & marked Ready to Ship!`);
      setPickingOrder(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to mark order as packed");
    }
  });

  const dispatchMutation = useMutation({
    mutationFn: ({ orderId, courier, tracking }: { orderId: string; courier: string; tracking: string }) =>
      marketplaceApi.dispatchOrder(orderId, { courier, tracking_number: tracking }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      toast.success(`Order ${variables.orderId} dispatched via ${variables.courier}. Physical stock updated!`);
      setDispatchingOrder(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to dispatch order");
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => marketplaceApi.cancelOrder(orderId),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Order ${orderId} cancelled. Stock reservation released.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel order");
    }
  });

  const ordersList = apiOrders || [];

  const filtered = ordersList.filter((o: any) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (o.id || "").toLowerCase().includes(term) ||
      (o.customerName || "").toLowerCase().includes(term) ||
      (o.vendorName || "").toLowerCase().includes(term) ||
      (o.invoice_number || "").toLowerCase().includes(term) ||
      (o.channel || "").toLowerCase().includes(term);

    let matchesStatus = true;
    if (statusFilter === "To Pick & Pack") {
      matchesStatus = (o.fulfillment_status === "Pending Pick" || o.status === "Processing" || o.status === "Pending") && o.status !== "Cancelled" && o.status !== "Shipped";
    } else if (statusFilter === "Ready to Ship") {
      matchesStatus = o.fulfillment_status === "Ready to Ship" || o.status === "Packed";
    } else if (statusFilter === "Dispatched") {
      matchesStatus = o.status === "Shipped" || o.fulfillment_status === "Shipped";
    } else if (statusFilter === "Delivered") {
      matchesStatus = o.status === "Delivered";
    } else if (statusFilter === "Cancelled") {
      matchesStatus = o.status === "Cancelled";
    }

    let matchesChannel = true;
    if (channelFilter !== "All") {
      matchesChannel = (o.channel || "Online Storefront").toLowerCase() === channelFilter.toLowerCase();
    }

    return matchesSearch && matchesStatus && matchesChannel;
  });

  const openPickModal = (order: any) => {
    setPickingOrder(order);
    const initialChecked: Record<string, boolean> = {};
    const items = Array.isArray(order.items) ? order.items : (order.itemsList || []);
    items.forEach((it: any, idx: number) => {
      initialChecked[`${order.id}-${idx}`] = false;
    });
    setPickedItems(initialChecked);
  };

  const openDispatchModal = (order: any) => {
    setDispatchingOrder(order);
    setCourierName(order.delivery_partner || "Careem Express");
    setTrackingNumber(order.tracking_number || `TRK-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const currentPickItems = Array.isArray(pickingOrder?.items) ? pickingOrder.items : (pickingOrder?.itemsList || []);
  const allItemsPicked = currentPickItems.length > 0
    ? currentPickItems.every((_: any, idx: number) => pickedItems[`${pickingOrder.id}-${idx}`])
    : true;

  const printDocument = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* ── Header & KPI Ribbon ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-purple-900/10 via-background to-slate-900/5 p-4 rounded-2xl border border-purple-500/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-sm">
              <Package className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Online & Multi-Vendor Fulfillment Center
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Store Dispatch Hub
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Fulfill online storefront and vendor orders directly from physical store stock with zero duplicate billing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-xl shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">Real-Time Stock Sync: Active</span>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors border cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Pipeline Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto bg-muted/50 p-1 rounded-xl border border-border/60">
          {[
            { id: "All", label: "All Orders", count: ordersList.length },
            {
              id: "To Pick & Pack",
              label: "📥 To Pick & Pack",
              count: ordersList.filter((o: any) => (o.fulfillment_status === "Pending Pick" || o.status === "Processing") && o.status !== "Cancelled" && o.status !== "Shipped").length
            },
            {
              id: "Ready to Ship",
              label: "📦 Ready to Ship",
              count: ordersList.filter((o: any) => o.fulfillment_status === "Ready to Ship").length
            },
            {
              id: "Dispatched",
              label: "🚚 Dispatched",
              count: ordersList.filter((o: any) => o.status === "Shipped" || o.fulfillment_status === "Shipped").length
            },
            {
              id: "Delivered",
              label: "✅ Delivered",
              count: ordersList.filter((o: any) => o.status === "Delivered").length
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer",
                statusFilter === tab.id
                  ? "bg-purple-700 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
                  statusFilter === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Channel Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer, SKU, Invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-medium focus:outline-none"
          >
            <option value="All">All Channels</option>
            <option value="Online Storefront">Online Storefront</option>
            <option value="B2B Marketplace">B2B Marketplace</option>
          </select>
        </div>
      </div>

      {/* ── Orders Table ── */}
      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3.5 text-left whitespace-nowrap">Order & Invoice ID</th>
                <th className="px-5 py-3.5 text-left whitespace-nowrap">Customer & Shipping</th>
                <th className="px-5 py-3.5 text-left whitespace-nowrap">Channel / Vendor</th>
                <th className="px-5 py-3.5 text-center whitespace-nowrap">Store Items</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Total Value</th>
                <th className="px-5 py-3.5 text-center whitespace-nowrap">Fulfillment Status</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Store Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="size-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Box className="size-6" />
                      </div>
                      <p className="text-sm font-bold text-foreground">No orders in this pipeline stage</p>
                      <p className="text-xs text-muted-foreground">Incoming store and online orders will appear here automatically.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((order: any) => {
                  const isToPick = (order.fulfillment_status === "Pending Pick" || order.status === "Processing" || order.status === "Pending") && order.status !== "Shipped" && order.status !== "Cancelled";
                  const isReadyToShip = order.fulfillment_status === "Ready to Ship";
                  const isShipped = order.status === "Shipped" || order.fulfillment_status === "Shipped";

                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Order & Invoice ID */}
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-purple-700 text-sm flex items-center gap-1.5">
                          {order.id}
                        </div>
                        {order.invoice_number ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                            <FileText className="size-3 text-slate-400" />
                            <span>{order.invoice_number}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Auto Tax Invoice</span>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(order.date || Date.now()).toLocaleDateString()} · {new Date(order.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Customer & Address */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground text-xs">{order.customerName}</div>
                        {order.customer_phone && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="size-3 text-slate-400" /> {order.customer_phone}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 line-clamp-1 max-w-[200px] mt-0.5">
                          {order.shipping_address || "Standard Storefront Delivery"}
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border",
                          order.channel === "Online Storefront" || !order.vendorId
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          <Store className="size-3" />
                          {order.channel || (order.vendorName ? `Vendor: ${order.vendorName}` : "Online Storefront")}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Payment: <span className="font-semibold text-foreground">{order.payment_method || "Online Paid"}</span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => openPickModal(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-purple-100 hover:text-purple-800 transition-colors text-slate-700 cursor-pointer"
                        >
                          <Box className="size-3.5" />
                          <span>{(Array.isArray(order.items) ? order.items.length : (order.items_count || (order.itemsList?.length || 1)))} items</span>
                          <ChevronRight className="size-3 opacity-60" />
                        </button>
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3.5 text-right font-black text-slate-900 text-sm">
                        {currency.symbol}{Number(order.total || 0).toFixed(2)}
                      </td>

                      {/* Fulfillment Status */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                          isShipped
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : isReadyToShip
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : order.status === "Delivered"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : order.status === "Cancelled"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        )}>
                          <span className={cn(
                            "size-1.5 rounded-full",
                            isShipped ? "bg-blue-500" : isReadyToShip ? "bg-amber-500" : isToPick ? "bg-purple-500 animate-ping" : "bg-emerald-500"
                          )} />
                          {order.fulfillment_status || order.status}
                        </span>
                        {order.tracking_number && (
                          <div className="text-[10px] font-mono text-slate-500 mt-1">
                            {order.delivery_partner}: {order.tracking_number}
                          </div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print Invoice Button */}
                          <button
                            onClick={() => setPrintingInvoiceOrder(order)}
                            className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-border/60 transition-colors cursor-pointer"
                            title="Print Tax Invoice for Parcel"
                          >
                            <Printer className="size-3.5" />
                          </button>

                          {/* Stage-based Action */}
                          {isToPick && (
                            <button
                              onClick={() => openPickModal(order)}
                              className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <CheckSquare className="size-3.5" /> Pick & Pack
                            </button>
                          )}

                          {isReadyToShip && (
                            <button
                              onClick={() => openDispatchModal(order)}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Truck className="size-3.5" /> Dispatch
                            </button>
                          )}

                          {isShipped && (
                            <button
                              onClick={() => openDispatchModal(order)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Truck className="size-3.5" /> Courier Details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL 1: In-Store Pick & Pack Checklist Modal ── */}
      <AnimatePresence>
        {pickingOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Package className="size-4 text-purple-700" />
                    Pick & Pack Station — {pickingOrder.id}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Locate physical items from the store shelves and verify before packaging.
                  </p>
                </div>
                <button
                  onClick={() => setPickingOrder(null)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {/* Order Summary banner */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-xl text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Customer:</span>
                    <span className="font-bold text-foreground">{pickingOrder.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Tax Invoice:</span>
                    <span className="font-mono font-bold text-purple-700">{pickingOrder.invoice_number || `INV-${pickingOrder.id}`}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Payment:</span>
                    <span className="font-semibold text-emerald-600">✓ {pickingOrder.payment_method || "Paid Online"}</span>
                  </div>
                </div>

                {/* Items Pick Checklist */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Store Picking Checklist
                  </h4>
                  <div className="space-y-2">
                    {((Array.isArray(pickingOrder.items) && pickingOrder.items.length > 0 ? pickingOrder.items : pickingOrder.itemsList) || [
                      { name: "Ordered Item", sku: "SKU-MAIN", rack_location: "Rack 1 / Shelf A", quantity: pickingOrder.items_count || 1, unit_price: pickingOrder.total }
                    ]).map((item: any, idx: number) => {
                      const itemKey = `${pickingOrder.id}-${idx}`;
                      const isChecked = pickedItems[itemKey] || false;

                      return (
                        <div
                          key={idx}
                          onClick={() => setPickedItems({ ...pickedItems, [itemKey]: !isChecked })}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                            isChecked
                              ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-900"
                              : "bg-background border-border hover:border-purple-500/30"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-5 rounded flex items-center justify-center border transition-colors",
                              isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"
                            )}>
                              {isChecked && <CheckCircle2 className="size-3.5" />}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-foreground">{item.name}</div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                <span className="font-mono text-slate-600 font-semibold">{item.sku || "SKU-001"}</span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 text-[10px]">
                                  <MapPin className="size-2.5" /> {item.rack_location || "Store Floor / Main Shelf"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs font-black text-foreground">
                              Qty: {item.quantity || 1}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {currency.symbol}{Number(item.unit_price || 0).toFixed(2)} each
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t bg-slate-50 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPrintingInvoiceOrder(pickingOrder);
                  }}
                  className="px-3 py-2 bg-background border border-border hover:bg-accent text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="size-3.5 text-purple-700" />
                  Print Official Tax Invoice
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickingOrder(null)}
                    className="px-3 py-2 bg-transparent text-slate-600 hover:text-foreground text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={packMutation.isPending}
                    onClick={() => packMutation.mutate(pickingOrder.id)}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-4" />
                    {packMutation.isPending ? "Packing..." : "Complete Packing & Mark Ready"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: Courier Dispatch & Stock Settlement Modal ── */}
      <AnimatePresence>
        {dispatchingOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Truck className="size-4 text-amber-600" />
                    Dispatch Order — {dispatchingOrder.id}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Assign courier and settle physical store inventory.
                  </p>
                </div>
                <button
                  onClick={() => setDispatchingOrder(null)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 text-amber-600" />
                    Automatic Real-Time Stock Settlement
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Dispatching will permanently deduct physical <strong>On-Hand Stock</strong> and release the <strong>Reserved Stock</strong> ledger entry.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Courier / Delivery Partner
                    </label>
                    <select
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="Careem Express">Careem Express (Same-Day)</option>
                      <option value="DHL Express">DHL Express</option>
                      <option value="FedEx Logistics">FedEx Logistics</option>
                      <option value="Delhivery Direct">Delhivery Direct</option>
                      <option value="BlueDart">BlueDart</option>
                      <option value="Store Own Fleet">Store Own Delivery Fleet</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tracking / Consignment Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TRK-84920194"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDispatchingOrder(null)}
                  className="px-3 py-2 bg-transparent text-slate-600 hover:text-foreground text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={dispatchMutation.isPending}
                  onClick={() =>
                    dispatchMutation.mutate({
                      orderId: dispatchingOrder.id,
                      courier: courierName,
                      tracking: trackingNumber,
                    })
                  }
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                  {dispatchMutation.isPending ? "Updating Stock..." : "Confirm Dispatch & Settle Stock"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: Printable Official Tax Invoice ── */}
      <AnimatePresence>
        {printingInvoiceOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white text-slate-900 border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Top toolbar */}
              <div className="p-3 bg-slate-900 text-white flex justify-between items-center print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-purple-400" />
                  <span className="font-bold text-xs">Official Omnichannel Tax Invoice</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={printDocument}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Printer className="size-3.5" /> Print Invoice
                  </button>
                  <button
                    onClick={() => setPrintingInvoiceOrder(null)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Body */}
              <div className="p-8 overflow-y-auto font-sans text-xs space-y-6 bg-white" id="tax-invoice-container">
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-6">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900">
                      {tenant?.name || "RETAIL STORE & E-COMMERCE HUB"}
                    </h1>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Main Commercial Hub, Trade Center Road, Dubai / India
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      GSTIN / TRN: <span className="font-mono font-bold text-slate-800">10049281900003</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block px-3 py-1 bg-purple-100 text-purple-900 font-extrabold text-sm rounded-md uppercase">
                      TAX INVOICE
                    </div>
                    <div className="text-xs font-bold font-mono text-slate-800 mt-2">
                      {printingInvoiceOrder.invoice_number || `INV-${printingInvoiceOrder.id}`}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Date: {new Date(printingInvoiceOrder.date || Date.now()).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Billed To / Shipped To */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Billed & Shipped To:
                    </span>
                    <div className="font-bold text-slate-900 text-sm">{printingInvoiceOrder.customerName}</div>
                    {printingInvoiceOrder.customer_phone && (
                      <div className="text-slate-600 mt-0.5">Phone: {printingInvoiceOrder.customer_phone}</div>
                    )}
                    <div className="text-slate-600 mt-0.5 max-w-xs">
                      {printingInvoiceOrder.shipping_address || "Customer Delivery Address Registered on Storefront"}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Order Details:
                    </span>
                    <div className="font-mono font-bold text-slate-900">Order ID: {printingInvoiceOrder.id}</div>
                    <div className="text-slate-600 mt-0.5">Channel: {printingInvoiceOrder.channel || "Online Storefront"}</div>
                    <div className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-[11px] mt-1">
                      ✓ Paid via {printingInvoiceOrder.payment_method || "Online Card / UPI"}
                    </div>
                  </div>
                </div>

                {/* Invoice Table */}
                <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Item Description</th>
                      <th className="p-3">SKU / Store Location</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {((Array.isArray(printingInvoiceOrder.items) && printingInvoiceOrder.items.length > 0 ? printingInvoiceOrder.items : printingInvoiceOrder.itemsList) || [
                      { name: "Online Store Product", sku: "SKU-MAIN", rack_location: "Central Floor", quantity: printingInvoiceOrder.items_count || 1, unit_price: printingInvoiceOrder.total }
                    ]).map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="p-3 text-slate-400">{i + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{it.name}</td>
                        <td className="p-3 font-mono text-slate-600 text-[11px]">
                          {it.sku || "SKU-MAIN"} ({it.rack_location || "Store Floor"})
                        </td>
                        <td className="p-3 text-right">{currency.symbol}{Number(it.unit_price || 0).toFixed(2)}</td>
                        <td className="p-3 text-center font-bold">{it.quantity || 1}</td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {currency.symbol}{Number((it.unit_price || 0) * (it.quantity || 1)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals & Tax Breakdown */}
                <div className="flex justify-between items-start pt-2">
                  <div className="text-[11px] text-slate-500 max-w-xs">
                    <p className="font-semibold text-slate-700">Omnichannel Store Fulfillment Notice:</p>
                    <p>This invoice is electronically generated and tax accounted. Do not re-bill at physical counter.</p>
                  </div>

                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Excl. Tax):</span>
                      <span>{currency.symbol}{(Number(printingInvoiceOrder.total || 0) * 0.82).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (9%):</span>
                      <span>{currency.symbol}{(Number(printingInvoiceOrder.total || 0) * 0.09).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (9%):</span>
                      <span>{currency.symbol}{(Number(printingInvoiceOrder.total || 0) * 0.09).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping Fee:</span>
                      <span className="text-emerald-600 font-semibold">FREE</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-2">
                      <span>Grand Total:</span>
                      <span>{currency.symbol}{Number(printingInvoiceOrder.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Signature */}
                <div className="border-t pt-4 flex justify-between items-end text-slate-400 text-[10px]">
                  <div>Thank you for shopping with us!</div>
                  <div className="text-right">
                    <div className="font-bold text-slate-700">Authorized Signatory</div>
                    <div>Digital Store Management Engine</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
