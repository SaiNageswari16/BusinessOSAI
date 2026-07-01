import { Card } from "../ui/card";
import { History, Search, Download } from "lucide-react";
import { Button } from "../ui/button";

export function PaymentHistory() {
  const data = [
    { id: 1, date: "2026-07-01", supplier: "Tata Consumer Products", amount: "₹4,20,000", mode: "Bank Transfer", ref: "TXN-998822" },
    { id: 2, date: "2026-06-25", supplier: "Samsung Electronics", amount: "₹12,45,000", mode: "NEFT", ref: "TXN-998811" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payment History</h2>
          <p className="text-sm text-muted-foreground">Comprehensive timeline of all vendor settlements.</p>
        </div>
        <Button variant="outline"><Download className="size-4 mr-2" /> Statement</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Amount Paid</th>
              <th className="px-6 py-4">Payment Mode</th>
              <th className="px-6 py-4">Transaction Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((txn) => (
              <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{txn.date}</td>
                <td className="px-6 py-4 font-bold">{txn.supplier}</td>
                <td className="px-6 py-4 font-bold text-emerald-600">{txn.amount}</td>
                <td className="px-6 py-4 text-xs font-semibold">{txn.mode}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{txn.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
