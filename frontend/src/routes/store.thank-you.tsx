import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Home, ShoppingBag, ArrowRight, Truck, Calendar } from "lucide-react";

export const Route = createFileRoute("/store/thank-you")({
  component: ThankYouPage,
});

function ThankYouPage() {
  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Order Confirmed
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Thank You</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
        <div className="size-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200">
          <CheckCircle2 className="size-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 font-organic-heading">
            Thank you for choosing Organic!
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
            Your fresh grocery order <span className="font-bold text-gray-900">#ORD-ORG-8924</span> has been confirmed.
            Our team is preparing your insulated cold-storage delivery.
          </p>
        </div>

        {/* Order Details Card */}
        <div className="p-6 rounded-3xl bg-[#FAF8EF] border border-gray-100 text-left space-y-4 max-w-md mx-auto text-xs">
          <div className="flex items-center justify-between border-b border-gray-200/60 pb-3">
            <span className="text-gray-500 font-medium">Estimated Arrival</span>
            <span className="font-bold text-gray-900 flex items-center gap-1.5">
              <Truck className="size-3.5 text-[#6BB252]" /> Today between 4:00 PM – 8:00 PM
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-gray-200/60 pb-3">
            <span className="text-gray-500 font-medium">Payment Status</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
              ✓ Paid via Card
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium">Delivery Mode</span>
            <span className="font-bold text-gray-900">100% Temperature-Controlled</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            to="/store/orders"
            className="bg-[#6BB252] hover:bg-[#5ba342] text-white font-bold text-xs px-6 py-3 rounded-full transition-all shadow-md"
          >
            Track Order Status
          </Link>
          <Link
            to="/store"
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs px-6 py-3 rounded-full transition-all"
          >
            Return to Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
