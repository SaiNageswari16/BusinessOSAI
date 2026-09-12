import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  Package, Truck, CheckCircle2, Clock, Home, ArrowRight, 
  RefreshCw, MapPin, Printer, ShieldCheck, Box, ChevronRight,
  Sparkles, FileText, AlertCircle, Copy, Check
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontUserOrders } from "@/lib/storefront-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const { currency } = useCurrency();
  const { user, isLoggedIn } = useStoreUser();
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  const { data: apiOrders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["store-user-orders", user?.email, user?.id],
    queryFn: () => fetchStorefrontUserOrders(user?.email, user?.id),
    refetchInterval: 5000, // Poll every 5s for live status transitions from marketplace admin!
  });

  // Fallback demo orders if brand new user has no placed orders yet
  const fallbackOrders = [
    {
      id: "ORD-ORG-8924",
      date: new Date().toISOString(),
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
        { name: "Whole Wheat Sandwich Bread", quantity: 1, unit_price: 18.0, sku: "SKU-BREAD-01", rack_location: "Bakery Aisle / Shelf 2" },
        { name: "Organic Baby Spinach", quantity: 2, unit_price: 6.5, sku: "SKU-SPINACH-04", rack_location: "Cold Fresh Rack 1" },
        { name: "Pure Squeezed Orange Juice", quantity: 1, unit_price: 8.5, sku: "SKU-JUICE-11", rack_location: "Beverage Chiller" },
      ],
    },
  ];

  const orders = apiOrders && apiOrders.length > 0 ? apiOrders : fallbackOrders;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(text);
    toast.success("Tracking number copied to clipboard!");
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const getStepProgress = (status: string, fulfillmentStatus: string) => {
    const s = (fulfillmentStatus || status || "").toLowerCase();
    if (s.includes("delivered")) return 4;
    if (s.includes("shipped") || s.includes("dispatched") || s.includes("in transit")) return 3;
    if (s.includes("packed") || s.includes("ready")) return 2;
    return 1; // Pending / Processing / Placed
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
          const isDelivered = step === 4;
          const isShipped = step >= 3;
          const isPacked = step >= 2;

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
                    isDelivered
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
                    isDelivered ? "bg-emerald-500" : isShipped ? "bg-blue-500" : isPacked ? "bg-amber-500" : "bg-purple-500"
                  )} />
                  {isDelivered
                    ? "✓ Delivered"
                    : isShipped
                    ? "🚚 In Transit / Dispatched"
                    : isPacked
                    ? "📦 Ready to Ship"
                    : "📝 Processing in Store"}
                </span>
              </div>

              {/* ── Visual Stepper Tracker ── */}
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

              {/* ── Tracking & ETA Details Banner ── */}
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
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
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
                        <div className="size-11 rounded-xl bg-[#FAF8EF] p-1 border border-gray-200 flex items-center justify-center shrink-0">
                          <Package className="size-5 text-gray-500" />
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 block">{item.name || item.product_name}</span>
                          <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                            <span>Qty: {item.quantity || 1}</span>
                            {item.sku && <span>• SKU: {item.sku}</span>}
                            {item.rack_location && <span>• Location: {item.rack_location}</span>}
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-gray-900">
                        {currency.symbol}{((item.unit_price || item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <MapPin className="size-3.5 text-[#6BB252]" />
                    <span>Delivering to: <strong className="text-gray-800">{order.deliveryAddress || "Registered Customer Address"}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to="/store/shop"
                      className="px-4 py-2 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
                    >
                      Shop More Items
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

