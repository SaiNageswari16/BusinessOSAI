import React, { useEffect, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Printer, RotateCcw, ReceiptText } from "lucide-react";
import { posApi, POSTransactionHistory } from "../../lib/api-client";

export function SalesHistory() {
  const [history, setHistory] = useState<POSTransactionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await posApi.getHistory();
        setHistory(Array.isArray(data) ? data : []);
      } catch (error) {
        console.warn("Failed to load sales history:", error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  const filteredSales = history.filter((sale) =>
    sale.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
    sale.items.some((item) => item.product_id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sales History</h2>
          <p className="text-sm text-slate-500 mt-1">View past receipts, reprint bills, and initiate refunds.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg border bg-card text-sm"
            placeholder="Search Receipt No..."
          />
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading sales history...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Receipt No</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSales.slice(0, 50).map((sale) => (
                <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2">
                    <ReceiptText className="size-4" /> {sale.receipt_number}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{new Date(sale.created_at).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 font-bold">{sale.cashier_id || "Customer"}</td>
                  <td className="px-6 py-4 font-mono">{sale.items.length} items</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">${sale.total_amount.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-slate-100 text-slate-700">
                      {sale.payments?.[0]?.payment_method || "cash"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Printer className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500"><RotateCcw className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No sales history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
