import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Home, ShoppingBag, ArrowRight, Truck, Calendar, FileText } from "lucide-react";

export const Route = createFileRoute("/store/thank-you")({
  component: ThankYouPage,
});

function ThankYouPage() {
  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-slate-50 py-8 mb-10 border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 font-organic-heading mb-2">
            Order Confirmed
          </h1>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#2563EB] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#2563EB] font-bold">Thank You</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
        <div className="size-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border-2 border-blue-200">
          <CheckCircle2 className="size-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-organic-heading">
            Thank you for ordering with BusinessOS Store!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Your commercial hardware order <span className="font-bold text-slate-900">#ORD-BOS-9482</span> has been confirmed.
            Our fulfillment center is preparing your consignment for express dispatch.
          </p>
        </div>

        {/* Order Details Card */}
        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 text-left space-y-4 max-w-md mx-auto text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <span className="text-slate-500 font-medium">Estimated Dispatch</span>
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Truck className="size-3.5 text-[#2563EB]" /> Express courier (24-48 hrs)
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <span className="text-slate-500 font-medium">Payment Status</span>
            <span className="inline-flex items-center gap-1 text-blue-600 font-bold">
              ✓ Paid & Invoiced
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">GST Tax Invoice</span>
            <span className="font-bold text-slate-900 flex items-center gap-1">
              <FileText className="size-3.5 text-[#2563EB]" /> Sent to registered email
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            to="/store/orders"
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold px-8 py-3.5 rounded-full transition-all shadow-md flex items-center gap-2"
          >
            Track Consignment <ArrowRight className="size-4" />
          </Link>

          <Link
            to="/store/shop"
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold px-8 py-3.5 rounded-full transition-all"
          >
            Continue Browsing
          </Link>
        </div>
      </div>
    </div>
  );
}
