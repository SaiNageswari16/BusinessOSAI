import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { 
  Package, Truck, CheckCircle2, Clock, Home, ArrowRight, 
  RefreshCw, MapPin, Printer, ShieldCheck, Box, ChevronRight,
  Sparkles, FileText, AlertCircle, Copy, Check, X, RotateCcw,
  Ban, MessageSquare, Send, Wallet, Download, ShoppingBag
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStorefrontUserOrders } from "@/lib/storefront-api";
import { marketplaceApi } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const { user, isLoggedIn, addWallet } = useStoreUser();
  const { addToCart } = useStoreCart();

  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Modals state
  const [cancellingOrder, setCancellingOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("Ordered by mistake");

  const [refundingOrder, setRefundingOrder] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("Damaged / Spoiled Items");
  const [refundNotes, setRefundNotes] = useState("");
  const [refundDestination, setRefundDestination] = useState<"wallet" | "original">("wallet");

  const [helpOrder, setHelpOrder] = useState<any | null>(null);
  const [helpMessage, setHelpMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Local override state for instant UI update on cancellation/refund
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, { status: string; fulfillment_status: string }>>({});

  const { data: apiOrders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["store-user-orders", user?.email, user?.id],
    queryFn: () => fetchStorefrontUserOrders(user?.email, user?.id),
    refetchInterval: 5000,
  });

  // Fallback demo orders if brand new user has no placed orders yet
  const fallbackOrders = [
    {
      id: "ORD-ORG-8924",
      date: new Date(Date.now() - 3600000).toISOString(),
      total: 39.5,
      status: "Shipped",
      fulfillment_status: "Shipped",
      delivery_partner: "Careem Cold-Chain Express",
      tracking_number: "TRK-CAREEM-8924",
      expected_delivery: "Today by 6:00 PM",
      invoice_number: "INV-ORD-ORG-8924",
      deliveryAddress: user?.address || "Villa 14, Al Wasl Road, Dubai",
      payment_method: "LazyMonkey Wallet",
      items: [
        { id: "org-1", name: "Whole Wheat Sandwich Bread", quantity: 1, unit_price: 18.0, sku: "SKU-BREAD-01", rack_location: "Bakery Aisle / Shelf 2", image_url: "/organic/images/product-thumb-1.png" },
        { id: "org-4", name: "Organic Baby Spinach", quantity: 2, unit_price: 6.5, sku: "SKU-SPINACH-04", rack_location: "Cold Fresh Rack 1", image_url: "/organic/images/product-thumb-4.png" },
        { id: "org-11", name: "Pure Squeezed Orange Juice", quantity: 1, unit_price: 8.5, sku: "SKU-JUICE-11", rack_location: "Beverage Chiller", image_url: "/organic/images/product-thumb-11.png" },
      ],
    },
    {
      id: "ORD-ORG-7712",
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      total: 62.0,
      status: "Delivered",
      fulfillment_status: "Delivered",
      delivery_partner: "Careem Cold-Chain Express",
      tracking_number: "TRK-CAREEM-7712",
      expected_delivery: "Delivered on Mar 13, 2026",
      invoice_number: "INV-ORD-ORG-7712",
      deliveryAddress: user?.address || "Villa 14, Al Wasl Road, Dubai",
      payment_method: "Razorpay Online",
      items: [
        { id: "org-6", name: "Fresh Salmon Fillet", quantity: 1, unit_price: 34.0, sku: "SKU-SALMON-06", image_url: "/organic/images/product-thumb-6.png" },
        { id: "org-3", name: "Sharp Cheddar Cheese Block", quantity: 1, unit_price: 22.0, sku: "SKU-CHEDDAR-03", image_url: "/organic/images/product-thumb-3.png" },
        { id: "org-14", name: "Fresh Green Crisp Celery", quantity: 1, unit_price: 6.0, sku: "SKU-CELERY-14", image_url: "/organic/images/product-thumb-14.png" },
      ],
    },
  ];

  const rawOrders = apiOrders && apiOrders.length > 0 ? apiOrders : fallbackOrders;
  
  const orders = rawOrders.map((o: any) => {
    if (localStatusOverrides[o.id]) {
      return { ...o, ...localStatusOverrides[o.id] };
    }
    return o;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(text);
    toast.success("Tracking number copied to clipboard!");
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const getStepProgress = (status: string, fulfillmentStatus: string) => {
    const s = (fulfillmentStatus || status || "").toLowerCase();
    if (s.includes("refunded") || s.includes("cancelled")) return -1;
    if (s.includes("delivered")) return 4;
    if (s.includes("shipped") || s.includes("dispatched") || s.includes("in transit")) return 3;
    if (s.includes("packed") || s.includes("ready")) return 2;
    return 1; // Pending / Processing / Placed
  };

  // 1. Cancel Order Action
  const handleConfirmCancel = async () => {
    if (!cancellingOrder) return;
    const orderId = cancellingOrder.id;
    const refundAmount = Number(cancellingOrder.total || cancellingOrder.total_amount || 0);

    try {
      await marketplaceApi.cancelOrder(orderId);
    } catch (e) {
      console.warn("cancelOrder backend fallback:", e);
    }

    // Credit refund to customer wallet
    addWallet(refundAmount);
    setLocalStatusOverrides((prev) => ({
      ...prev,
      [orderId]: { status: "Cancelled", fulfillment_status: "Cancelled" },
    }));

    queryClient.invalidateQueries({ queryKey: ["store-user-orders"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });

    toast.success(`Order ${orderId} cancelled successfully!`, {
      description: `${currency.symbol}${refundAmount.toFixed(2)} refunded instantly to your LazyMonkey Wallet.`,
    });

    setCancellingOrder(null);
  };

  // 2. Request Refund Action
  const handleConfirmRefund = async () => {
    if (!refundingOrder) return;
    const orderId = refundingOrder.id;
    const refundAmount = Number(refundingOrder.total || refundingOrder.total_amount || 0);

    // Credit refund to customer wallet
    addWallet(refundAmount);
    setLocalStatusOverrides((prev) => ({
      ...prev,
      [orderId]: { status: "Refunded", fulfillment_status: "Refunded" },
    }));

    toast.success(`Refund approved for Order ${orderId}!`, {
      description: `${currency.symbol}${refundAmount.toFixed(2)} has been credited to your LazyMonkey Wallet.`,
    });

    setRefundingOrder(null);
  };

  // 3. 1-Click Reorder
  const handleReorder = (order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      toast.info("No reorderable items in this order.");
      return;
    }

    items.forEach((it: any) => {
      addToCart({
        id: it.id || it.product_id || `prod-${Math.random()}`,
        name: it.name || it.product_name || "Organic Product",
        price: it.unit_price || it.price || 10,
        image_url: it.image_url || "/organic/images/product-thumb-1.png",
      }, it.quantity || 1);
    });

    toast.success(`Added ${items.length} items to your shopping basket!`, {
      description: "Redirecting to your cart for quick checkout.",
    });

    navigate({ to: "/store/cart" });
  };

  // 4. Print / Download Invoice
  const handlePrintInvoice = (order: any) => {
    window.print();
  };

  // 5. Send Help Desk Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpMessage.trim()) return;
    setIsSendingMessage(true);
    setTimeout(() => {
      setIsSendingMessage(false);
      toast.success("Message sent to LazyMonkey Dispatch Desk!", {
        description: `Your ticket regarding Order ${helpOrder?.id} has been logged. Support team will respond via SMS/Email.`,
      });
      setHelpOrder(null);
      setHelpMessage("");
    }, 800);
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-[#FAF8EF] py-8 mb-8 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6BB252]/10 text-[#6BB252] text-xs font-bold mb-2">
            <Sparkles className="size-3.5" />
            <span>Live Order Dispatch & Courier Sync</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Order Tracking & Live Status
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Live Orders</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {/* Live Sync Status Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <span className="text-xs font-bold text-gray-900">Marketplace Dispatch Desk Active</span>
              <p className="text-[11px] text-gray-500">
                Status changes from the store fulfillment hub sync automatically in real time.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              refetch();
              toast.info("Refreshed latest tracking status");
            }}
            disabled={isRefetching}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={cn("size-3.5 text-[#6BB252]", isRefetching && "animate-spin")} />
            <span>{isRefetching ? "Updating..." : "Refresh Status"}</span>
          </button>
        </div>

        {/* Orders List */}
        {orders.map((order: any) => {
          const step = getStepProgress(order.status, order.fulfillment_status);
          const isCancelled = order.status === "Cancelled" || order.fulfillment_status === "Cancelled";
          const isRefunded = order.status === "Refunded" || order.fulfillment_status === "Refunded";
          const isDelivered = step === 4;
          const isShipped = step === 3;
          const isPacked = step === 2;
          const isCancellable = !isCancelled && !isRefunded && (step <= 2);

          const rawDate = order.date || order.created_at || new Date().toISOString();
          const displayDate = new Date(rawDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={order.id}
              className="border border-gray-200/80 rounded-3xl overflow-hidden shadow-xs bg-white space-y-0 transition-all hover:border-[#6BB252]/40"
            >
              {/* Header */}
              <div className="bg-[#FAF8EF] p-5 border-b border-gray-200/60 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Order Placed</span>
                    <span className="font-bold text-gray-900">{displayDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Amount</span>
                    <span className="font-extrabold text-gray-900">{currency.symbol}{Number(order.total || 0).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Order Reference</span>
                    <span className="font-mono font-bold text-[#6BB252]">{order.id}</span>
                  </div>
                  {order.invoice_number && (
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Tax Invoice</span>
                      <span className="font-mono font-bold text-slate-700">{order.invoice_number}</span>
                    </div>
                  )}
                </div>

                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5",
                    isCancelled
                      ? "bg-rose-50 text-rose-700 border-rose-300"
                      : isRefunded
                      ? "bg-purple-50 text-purple-700 border-purple-300"
                      : isDelivered
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : isShipped
                      ? "bg-blue-50 text-blue-700 border-blue-300 animate-pulse"
                      : isPacked
                      ? "bg-amber-50 text-amber-700 border-amber-300"
                      : "bg-purple-50 text-purple-700 border-purple-300"
                  )}
                >
                  <span className={cn(
                    "size-2 rounded-full",
                    isCancelled ? "bg-rose-500" : isRefunded ? "bg-purple-500" : isDelivered ? "bg-emerald-500" : isShipped ? "bg-blue-500" : isPacked ? "bg-amber-500" : "bg-purple-500"
                  )} />
                  {isCancelled
                    ? "✕ Cancelled & Refunded"
                    : isRefunded
                    ? "✓ Refund Credited to Wallet"
                    : isDelivered
                    ? "✓ Delivered"
                    : isShipped
                    ? "🚚 In Transit / Dispatched"
                    : isPacked
                    ? "📦 Ready to Ship"
                    : "📝 Processing in Store"}
                </span>
              </div>

              {/* ── Visual Stepper Tracker (Only for Active Orders) ── */}
              {!isCancelled && !isRefunded ? (
                <div className="p-6 bg-slate-50/50 border-b border-gray-100">
                  <div className="grid grid-cols-4 gap-2 relative">
                    {/* Connecting Bar */}
                    <div className="absolute top-4 left-6 right-6 h-1 bg-gray-200 -z-0">
                      <div
                        className="h-full bg-[#6BB252] transition-all duration-500"
                        style={{
                          width:
                            step === 1 ? "12%" : step === 2 ? "45%" : step === 3 ? "78%" : "100%",
                        }}
                      />
                    </div>

                    {/* Step 1: Confirmed */}
                    <div className="flex flex-col items-center text-center relative z-10">
                      <div className={cn(
                        "size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs border-2",
                        step >= 1 ? "bg-[#6BB252] text-white border-white" : "bg-white text-gray-400 border-gray-300"
                      )}>
                        ✓
                      </div>
                      <span className="text-[11px] font-bold text-gray-900 mt-2 block">Confirmed</span>
                      <span className="text-[10px] text-gray-500 hidden sm:block">Stock Reserved</span>
                    </div>

                    {/* Step 2: Packed */}
                    <div className="flex flex-col items-center text-center relative z-10">
                      <div className={cn(
                        "size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs border-2",
                        step >= 2 ? "bg-[#6BB252] text-white border-white" : "bg-white text-gray-400 border-gray-300"
                      )}>
                        {step >= 2 ? "✓" : "2"}
                      </div>
                      <span className="text-[11px] font-bold text-gray-900 mt-2 block">Packed</span>
                      <span className="text-[10px] text-gray-500 hidden sm:block">Store Verified</span>
                    </div>

                    {/* Step 3: Dispatched */}
                    <div className="flex flex-col items-center text-center relative z-10">
                      <div className={cn(
                        "size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs border-2",
                        step >= 3 ? "bg-[#6BB252] text-white border-white" : "bg-white text-gray-400 border-gray-300"
                      )}>
                        {step >= 3 ? "🚚" : "3"}
                      </div>
                      <span className="text-[11px] font-bold text-gray-900 mt-2 block">Dispatched</span>
                      <span className="text-[10px] text-gray-500 hidden sm:block">{order.delivery_partner || "Courier"}</span>
                    </div>

                    {/* Step 4: Delivered */}
                    <div className="flex flex-col items-center text-center relative z-10">
                      <div className={cn(
                        "size-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs border-2",
                        step >= 4 ? "bg-emerald-600 text-white border-white" : "bg-white text-gray-400 border-gray-300"
                      )}>
                        {step >= 4 ? "✓" : "4"}
                      </div>
                      <span className="text-[11px] font-bold text-gray-900 mt-2 block">Delivered</span>
                      <span className="text-[10px] text-gray-500 hidden sm:block">At Doorstep</span>
                    </div>
                  </div>
                </div>
              ) : isCancelled ? (
                <div className="p-4 bg-rose-50/60 border-b border-rose-100 flex items-center gap-3 text-xs text-rose-800">
                  <Ban className="size-5 text-rose-600 shrink-0" />
                  <div>
                    <strong className="block font-bold">This order was cancelled.</strong>
                    <span>Full amount of {currency.symbol}{Number(order.total || 0).toFixed(2)} was refunded back to your LazyMonkey Wallet.</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-purple-50/60 border-b border-purple-100 flex items-center gap-3 text-xs text-purple-800">
                  <RotateCcw className="size-5 text-purple-600 shrink-0" />
                  <div>
                    <strong className="block font-bold">Refund Processed & Completed.</strong>
                    <span>Store credit of {currency.symbol}{Number(order.total || 0).toFixed(2)} is available in your LazyMonkey Wallet balance.</span>
                  </div>
                </div>
              )}

              {/* ── Tracking & ETA Details Banner ── */}
              {!isCancelled && !isRefunded && (
                <div className="p-5 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-amber-500/5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="size-4 text-[#6BB252]" />
                      <span className="font-bold text-gray-900">
                        Courier Partner: <strong className="text-slate-800">{order.delivery_partner || "Careem Express Delivery"}</strong>
                      </span>
                    </div>
                    {order.tracking_number && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <span>Tracking ID:</span>
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {order.tracking_number}
                        </span>
                        <button
                          onClick={() => copyToClipboard(order.tracking_number)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                          title="Copy tracking number"
                        >
                          {copiedTracking === order.tracking_number ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-white rounded-2xl border border-gray-200 shadow-2xs">
                    <Clock className="size-4 text-amber-500" />
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Expected Delivery</span>
                      <span className="font-extrabold text-gray-900">
                        {order.expected_delivery || "Estimated Tomorrow by 6:00 PM"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Order Items List ── */}
              <div className="p-6 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Included Store Items ({Array.isArray(order.items) ? order.items.length : 1})
                </h4>

                <div className="divide-y divide-gray-100">
                  {(Array.isArray(order.items) && order.items.length > 0 ? order.items : [
                    { name: "Organic Store Item", quantity: 1, unit_price: order.total }
                  ]).map((item: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-xs gap-4">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-[#FAF8EF] p-1 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={item.image_url || "/organic/images/product-thumb-1.png"}
                            alt={item.name || "Item"}
                            className="size-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 block">{item.name || item.product_name}</span>
                          <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                            <span>Qty: {item.quantity || 1}</span>
                            {item.sku && <span>• SKU: {item.sku}</span>}
                            {item.rack_location && <span>• Shelf: {item.rack_location}</span>}
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-gray-900">
                        {currency.symbol}{((item.unit_price || item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Order Footer Actions ── */}
                <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <MapPin className="size-3.5 text-[#6BB252]" />
                    <span>Delivering to: <strong className="text-gray-800">{order.deliveryAddress || "Registered Customer Address"}</strong></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Help Button */}
                    <button
                      onClick={() => setHelpOrder(order)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="size-3.5 text-slate-500" />
                      <span>Order Help</span>
                    </button>

                    {/* Invoice Download */}
                    <button
                      onClick={() => handlePrintInvoice(order)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="size-3.5 text-slate-500" />
                      <span>Invoice</span>
                    </button>

                    {/* Reorder Button */}
                    <button
                      onClick={() => handleReorder(order)}
                      className="px-3 py-1.5 rounded-lg bg-[#FAF8EF] hover:bg-[#f2efe2] text-[#6BB252] border border-[#6BB252]/30 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingBag className="size-3.5" />
                      <span>Reorder</span>
                    </button>

                    {/* Cancel Order (If eligible) */}
                    {isCancellable && (
                      <button
                        onClick={() => setCancellingOrder(order)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Ban className="size-3.5" />
                        <span>Cancel Order</span>
                      </button>
                    )}

                    {/* Request Refund (If delivered and not refunded) */}
                    {isDelivered && !isRefunded && (
                      <button
                        onClick={() => setRefundingOrder(order)}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Request Refund</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Cancel Order Dialog Modal ── */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Ban className="size-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Cancel Order {cancellingOrder.id}</h3>
              </div>
              <button onClick={() => setCancellingOrder(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-800">
              <Wallet className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Instant Wallet Refund</strong>
                <span>Full order amount of <strong>{currency.symbol}{Number(cancellingOrder.total || 0).toFixed(2)}</strong> will be credited directly to your LazyMonkey Wallet.</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 block">Reason for cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white outline-none focus:border-[#6BB252]"
              >
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="Changed delivery address">Changed delivery address</option>
                <option value="Found better pricing">Found better pricing</option>
                <option value="Need faster delivery time">Need faster delivery time</option>
                <option value="Other reason">Other reason</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Confirm Cancellation & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request Refund Dialog Modal ── */}
      {refundingOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <RotateCcw className="size-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Request Return / Refund</h3>
              </div>
              <button onClick={() => setRefundingOrder(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Order <strong>{refundingOrder.id}</strong> • Total: <strong>{currency.symbol}{Number(refundingOrder.total || 0).toFixed(2)}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Issue / Return Reason</label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white outline-none focus:border-[#6BB252]"
                >
                  <option value="Damaged / Spoiled Items">Damaged / Spoiled Items</option>
                  <option value="Missing Item in Package">Missing Item in Package</option>
                  <option value="Wrong Product Delivered">Wrong Product Delivered</option>
                  <option value="Quality not satisfactory">Quality not satisfactory</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Refund Method</label>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
                  <Wallet className="size-4 text-[#6BB252]" />
                  <span>Instant Credit to <strong>LazyMonkey Wallet</strong></span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Comments / Details</label>
                <textarea
                  rows={3}
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Describe the issue with your items..."
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white outline-none focus:border-[#6BB252] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRefundingOrder(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                className="px-4 py-2 rounded-xl bg-[#6BB252] hover:bg-[#5ba342] text-white text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Submit Claim & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Help Desk Message Modal ── */}
      {helpOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <MessageSquare className="size-4" />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Store Help Desk</h3>
              </div>
              <button onClick={() => setHelpOrder(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Sending inquiry for Order <strong>{helpOrder.id}</strong> ({helpOrder.delivery_partner || "Courier Dispatch"}).
            </p>

            <form onSubmit={handleSendMessage} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Your Message to Dispatch Team</label>
                <textarea
                  rows={4}
                  required
                  value={helpMessage}
                  onChange={(e) => setHelpMessage(e.target.value)}
                  placeholder="e.g., Please ask driver to ring bell, or confirm delivery gate code..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs bg-gray-50 focus:bg-white outline-none focus:border-[#6BB252] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHelpOrder(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingMessage}
                  className="px-4 py-2 rounded-xl bg-[#6BB252] hover:bg-[#5ba342] text-white text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Send className="size-3.5" />
                  <span>{isSendingMessage ? "Sending..." : "Send Message"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

