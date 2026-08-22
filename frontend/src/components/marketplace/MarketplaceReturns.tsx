import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, CheckCircle2, XCircle, Clock, Search, Package, Store, AlertTriangle, RefreshCw, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/marketplace-api";

interface ReturnRMA {
  id: string;
  orderId: string;
  customerName: string;
  vendorName: string;
  itemTitle: string;
  reason: string;
  requestedDate: string;
  amount: number;
  resolutionType: "Refund to Wallet" | "Replacement Item" | "Original Payment Method";
  status: "Pending Review" | "RMA Approved" | "Rejected" | "Item Received & Processed";
}

export function MarketplaceReturns() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [returnRequests, setReturnRequests] = useState<ReturnRMA[]>([
    {
      id: "RMA-901",
      orderId: "ORD-8821",
      customerName: "Sarah Jenkins",
      vendorName: "Urban Retail Group",
      itemTitle: "Ergonomic Executive Office Chair",
      reason: "Outer packaging dented on delivery, minor scratch on armrest.",
      requestedDate: "2026-08-14",
      amount: 245.00,
      resolutionType: "Replacement Item",
      status: "Pending Review",
    },
    {
      id: "RMA-902",
      orderId: "ORD-8815",
      customerName: "David Miller",
      vendorName: "Apex Tech Solutions",
      itemTitle: "Ultra HD LED Monitor",
      reason: "Dead pixels detected on screen.",
      requestedDate: "2026-08-12",
      amount: 180.00,
      resolutionType: "Refund to Wallet",
      status: "RMA Approved",
    },
    {
      id: "RMA-903",
      orderId: "ORD-8790",
      customerName: "Amira Al-Mansoor",
      vendorName: "Nexus Supply Chain",
      itemTitle: "Precision Industrial Tool Set",
      reason: "Incompatible spec for target machinery.",
      requestedDate: "2026-08-10",
      amount: 320.00,
      resolutionType: "Original Payment Method",
      status: "Item Received & Processed",
    },
  ]);

  useEffect(() => {
    marketplaceApi.getReturns().then(data => {
      if (data.returns && data.returns.length > 0) {
        setReturnRequests(data.returns.map((r: any) => ({
          id: r.id,
          orderId: r.orderId || `ORD-${r.id.slice(-4)}`,
          customerName: r.customerName || "Customer",
          vendorName: r.vendorName || "Marketplace Seller",
          itemTitle: r.itemTitle || "Product Item",
          reason: r.reason || "Customer return request",
          requestedDate: r.date || "2026-08-14",
          amount: Number(r.amount || 150.0),
          resolutionType: "Refund to Wallet",
          status: r.status === "Approved" ? "RMA Approved" : (r.status === "Rejected" ? "Rejected" : "Pending Review"),
        })));
      }
    }).catch(() => {});
  }, []);

  const updateStatus = (id: string, status: ReturnRMA["status"]) => {
    setReturnRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const filtered = returnRequests.filter(r => {
    const matchesSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Returns & RMA Requests</h1>
          <p className="text-sm text-muted-foreground">Manage customer return merchandise authorizations (RMA), defect inspections, and replacement vs refund resolutions.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search RMA or Order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none"
          >
            <option value="all">All RMA Status</option>
            <option value="pending review">Pending Review</option>
            <option value="rma approved">RMA Approved</option>
            <option value="item received & processed">Item Received</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((rma, i) => (
          <motion.div
            key={rma.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 space-y-4 hover:border-primary/20 transition-all"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold font-mono text-sm border border-primary/20">
                  <ArrowRightLeft className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground font-mono">{rma.id}</span>
                    <span className="text-xs text-muted-foreground">Order: <strong className="text-foreground">{rma.orderId}</strong></span>
                  </div>
                  <p className="text-xs text-muted-foreground">Customer: <strong className="text-foreground">{rma.customerName}</strong> • Requested: {rma.requestedDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-base font-extrabold text-foreground font-mono">${rma.amount.toFixed(2)}</span>
                <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                  rma.status === "Item Received & Processed" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                  rma.status === "RMA Approved" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20" :
                  rma.status === "Pending Review" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                  "bg-red-500/10 text-red-600 border border-red-500/20"
                )}>
                  {rma.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-background/50 p-3 rounded-lg border border-border/40 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Item & Vendor Info</span>
                <p className="font-semibold text-foreground text-sm">{rma.itemTitle}</p>
                <p className="text-muted-foreground">Vendor: <strong className="text-primary">{rma.vendorName}</strong></p>
              </div>
              <div className="bg-background/50 p-3 rounded-lg border border-border/40 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Return Reason & Resolution</span>
                <p className="text-foreground font-medium">{rma.reason}</p>
                <p className="text-muted-foreground">Target Outcome: <strong className="text-emerald-600">{rma.resolutionType}</strong></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              {rma.status === "Pending Review" && (
                <>
                  <button 
                    onClick={() => updateStatus(rma.id, "RMA Approved")}
                    className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 className="size-3.5" /> Approve RMA
                  </button>
                  <button 
                    onClick={() => updateStatus(rma.id, "Rejected")}
                    className="px-3.5 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-red-500/20"
                  >
                    <XCircle className="size-3.5" /> Reject Request
                  </button>
                </>
              )}
              {rma.status === "RMA Approved" && (
                <button 
                  onClick={() => updateStatus(rma.id, "Item Received & Processed")}
                  className="px-3.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <Package className="size-3.5" /> Mark Item Received & Refund
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
