import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { FileCheck, Plus } from "lucide-react";

export function CreditNotes() {
  const data = [
    { id: 1, cnNo: "CN-2026-001", supplier: "Samsung Electronics", amount: "₹50,000", date: "2026-06-20", reason: "Volume Discount" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Credit Notes</h2>
          <p className="text-sm text-muted-foreground">Track vendor credits for returns and discounts.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Generate CN</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">CN Number</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((cn) => (
              <tr key={cn.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2"><FileCheck className="size-4" /> {cn.cnNo}</td>
                <td className="px-6 py-4 font-bold">{cn.supplier}</td>
                <td className="px-6 py-4 font-bold text-emerald-600">{cn.amount}</td>
                <td className="px-6 py-4 font-mono text-xs">{cn.date}</td>
                <td className="px-6 py-4 text-sm">{cn.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
