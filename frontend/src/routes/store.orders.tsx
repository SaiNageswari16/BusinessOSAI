import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Truck, CheckCircle2, Clock, Home, ArrowRight } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const { currency } = useCurrency();

  const organicOrders = [
    {
      id: "ORD-ORG-8924",
      date: "September 3, 2026",
      total: 39.5,
      status: "In Transit",
      courier: "Careem Cold-Chain Express",
      eta: "Today by 6:00 PM",
      items: [
        { name: "Whole Wheat Sandwich Bread", quantity: 1, price: 18.0, image: "/organic/images/product-thumb-1.png" },
        { name: "Organic Baby Spinach", quantity: 2, price: 6.5, image: "/organic/images/product-thumb-4.png" },
        { name: "Pure Squeezed Orange Juice", quantity: 1, price: 8.5, image: "/organic/images/product-thumb-11.png" },
      ],
    },
    {
      id: "ORD-ORG-8412",
      date: "August 28, 2026",
      total: 58.0,
      status: "Delivered",
      courier: "Aramex Logistics",
      eta: "Delivered on Aug 28",
      items: [
        { name: "Fresh Salmon Fillet", quantity: 1, price: 34.0, image: "/organic/images/product-thumb-6.png" },
        { name: "Greek Style Plain Yogurt", quantity: 2, price: 8.5, image: "/organic/images/product-thumb-10.png" },
        { name: "Honeycrisp Apples", quantity: 1, price: 7.0, image: "/organic/images/product-thumb-15.png" },
      ],
    },
  ];

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Order Tracking & History
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Orders</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {organicOrders.map((order) => (
          <div
            key={order.id}
            className="border border-gray-100 rounded-3xl overflow-hidden shadow-xs bg-white"
          >
            {/* Header */}
            <div className="bg-[#FAF8EF] p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Order Placed</span>
                  <span className="font-bold text-gray-900">{order.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Order Total</span>
                  <span className="font-extrabold text-gray-900">{currency.symbol}{order.total.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Order Number</span>
                  <span className="font-mono font-bold text-[#6BB252]">{order.id}</span>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                  order.status === "Delivered"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {order.status === "Delivered" ? "✓ Delivered" : "🚚 In Transit"}
              </span>
            </div>

            {/* Content & items */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <Truck className="size-4 text-[#6BB252]" />
                <span>Dispatched via {order.courier} • ETA: {order.eta}</span>
              </div>

              <div className="divide-y divide-gray-100">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl bg-[#FAF8EF] p-1 border border-gray-200 flex items-center justify-center shrink-0">
                        <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block">{item.name}</span>
                        <span className="text-gray-400">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900">
                      {currency.symbol}{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Link
                  to="/store/shop"
                  className="px-5 py-2 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
                >
                  Buy Again
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
