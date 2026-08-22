import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Printer, Search, DollarSign, Building2, Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketplaceInvoice {
  id: string;
  orderId: string;
  customerName: string;
  vendorName: string;
  taxNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  date: string;
  status: "Issued" | "Paid" | "Pending Tax Settlement";
}

export function MarketplaceInvoices() {
  const [searchTerm, setSearchTerm] = useState("");

  const [invoices, setInvoices] = useState<MarketplaceInvoice[]>([
    {
      id: "INV-2026-901",
      orderId: "ORD-8825",
      customerName: "David Miller",
      vendorName: "Apex Tech Solutions",
      taxNumber: "GSTIN-29AAAAA0000A1Z5",
      subtotal: 160.99,
      taxAmount: 29.00,
      totalAmount: 189.99,
      date: "2026-08-15",
      status: "Issued",
    },
    {
      id: "INV-2026-902",
      orderId: "ORD-8821",
      customerName: "Sarah Jenkins",
      vendorName: "Urban Retail Group",
      taxNumber: "VAT-998822110",
      subtotal: 215.00,
      taxAmount: 30.00,
      totalAmount: 245.00,
      date: "2026-08-14",
      status: "Paid",
    },
  ]);

  const filtered = invoices.filter(inv =>
    inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Tax Invoices & Billing Records</h1>
          <p className="text-sm text-muted-foreground">Generate, download, and print GST/VAT multi-vendor split invoices for marketplace buyers.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Invoice or Order ID..."
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
            <FileText className="size-4 text-primary" /> Multi-Vendor Tax Invoices
          </h3>
          <span className="text-xs text-muted-foreground">Compliant with regional GST & VAT regulations</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="bg-muted/40 uppercase font-semibold text-[10px] text-foreground border-b border-border/50">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Order #</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Vendor</th>
                <th className="p-3.5">Tax Reg No</th>
                <th className="p-3.5">Subtotal</th>
                <th className="p-3.5">Tax</th>
                <th className="p-3.5">Total Amount</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((inv, i) => (
                <motion.tr
                  key={inv.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <td className="p-3.5 font-bold font-mono text-foreground">{inv.id}</td>
                  <td className="p-3.5 font-mono text-foreground">{inv.orderId}</td>
                  <td className="p-3.5 font-medium text-foreground">{inv.customerName}</td>
                  <td className="p-3.5 text-foreground">{inv.vendorName}</td>
                  <td className="p-3.5 font-mono text-[10px] text-muted-foreground">{inv.taxNumber}</td>
                  <td className="p-3.5 font-mono text-foreground">${inv.subtotal.toFixed(2)}</td>
                  <td className="p-3.5 font-mono text-foreground">${inv.taxAmount.toFixed(2)}</td>
                  <td className="p-3.5 font-bold font-mono text-emerald-500 text-sm">${inv.totalAmount.toFixed(2)}</td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className="p-1.5 bg-accent hover:bg-accent/80 text-foreground rounded-lg transition-colors" title="Print Invoice">
                        <Printer className="size-3.5" />
                      </button>
                      <button className="p-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors" title="Download Tax Invoice PDF">
                        <Download className="size-3.5" />
                      </button>
                    </div>
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
