import React, { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Clock, Search, DollarSign, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerRefund {
  id: string;
  orderId: string;
  customerName: string;
  vendorName: string;
  refundAmount: number;
  refundMethod: "Store Credit Wallet" | "Credit Card (Stripe)" | "Bank Transfer";
  processedDate: string;
  transactionRef: string;
  status: "Completed" | "Processing" | "Failed";
}

export function MarketplaceRefunds() {
  const [searchTerm, setSearchTerm] = useState("");

  const [refunds, setRefunds] = useState<CustomerRefund[]>([
    {
      id: "RFD-501",
      orderId: "ORD-8790",
      customerName: "Amira Al-Mansoor",
      vendorName: "Nexus Supply Chain",
      refundAmount: 320.00,
      refundMethod: "Credit Card (Stripe)",
      processedDate: "2026-08-11 14:30",
      transactionRef: "txn_3N82x9L01a9xZ",
      status: "Completed",
    },
    {
      id: "RFD-502",
      orderId: "ORD-8815",
      customerName: "David Miller",
      vendorName: "Apex Tech Solutions",
      refundAmount: 115.00,
      refundMethod: "Store Credit Wallet",
      processedDate: "2026-08-13 09:15",
      transactionRef: "wlet_991823a",
      status: "Completed",
    },
    {
      id: "RFD-503",
      orderId: "ORD-8821",
      customerName: "Sarah Jenkins",
      vendorName: "Urban Retail Group",
      refundAmount: 245.00,
      refundMethod: "Credit Card (Stripe)",
      processedDate: "2026-08-15 11:00",
      transactionRef: "txn_3N89y7M12b10y",
      status: "Processing",
    },
  ]);

  const filtered = refunds.filter(r =>
    r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Customer Refunds & Reversals</h1>
          <p className="text-sm text-muted-foreground">Track buyer refund logs, payment gateway transaction references, and wallet credit status.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search refund or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <CreditCard className="size-4 text-emerald-500" /> Customer Refund Logs
          </h3>
          <span className="text-xs text-muted-foreground">Synced with payment gateway & store wallet</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="bg-muted/40 uppercase font-semibold text-[10px] text-foreground border-b border-border/50">
              <tr>
                <th className="p-3.5">Refund ID</th>
                <th className="p-3.5">Order ID</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Vendor</th>
                <th className="p-3.5">Refund Method</th>
                <th className="p-3.5">Transaction Ref</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <td className="p-3.5 font-bold font-mono text-foreground">{r.id}</td>
                  <td className="p-3.5 font-mono text-foreground">{r.orderId}</td>
                  <td className="p-3.5 font-medium text-foreground">{r.customerName}</td>
                  <td className="p-3.5 text-foreground">{r.vendorName}</td>
                  <td className="p-3.5">{r.refundMethod}</td>
                  <td className="p-3.5 font-mono text-[10px] text-muted-foreground">{r.transactionRef}</td>
                  <td className="p-3.5 font-bold font-mono text-emerald-500 text-sm">${r.refundAmount.toFixed(2)}</td>
                  <td className="p-3.5 text-right">
                    <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                      r.status === "Completed" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                      r.status === "Processing" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                      "bg-red-500/10 text-red-600 border border-red-500/20"
                    )}>
                      {r.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
