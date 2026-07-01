import { posSales } from "../../data/pos-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Printer, RotateCcw, ReceiptText } from "lucide-react";

export function SalesHistory() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales History</h2>
          <p className="text-sm text-muted-foreground">View past receipts, reprint bills, and initiate refunds.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input className="w-full h-10 pl-9 pr-4 rounded-lg border bg-card text-sm" placeholder="Search Receipt No..." />
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
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
            {posSales.map((sale) => (
              <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2"><ReceiptText className="size-4" /> {sale.receiptNo}</td>
                <td className="px-6 py-4 font-mono text-xs">{sale.time}</td>
                <td className="px-6 py-4 font-bold">{sale.customer}</td>
                <td className="px-6 py-4 font-mono">{sale.items}</td>
                <td className="px-6 py-4 font-bold text-emerald-600">{sale.total}</td>
                <td className="px-6 py-4 text-xs font-semibold bg-muted/50 rounded w-fit px-2 py-0.5">{sale.method}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Printer className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500"><RotateCcw className="size-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
