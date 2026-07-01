import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { FileCheck, Plus } from "lucide-react";

export function DebitNotes() {
  const data = [
    { id: 1, dnNo: "DN-2026-001", supplier: "Nike India", amount: "₹12,000", date: "2026-06-22", reason: "Damaged Goods Return" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Debit Notes</h2>
          <p className="text-sm text-muted-foreground">Generate debit notes for purchase returns or excess billing.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Generate DN</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">DN Number</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((dn) => (
              <tr key={dn.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2"><FileCheck className="size-4 text-rose-500" /> {dn.dnNo}</td>
                <td className="px-6 py-4 font-bold">{dn.supplier}</td>
                <td className="px-6 py-4 font-bold text-rose-500">{dn.amount}</td>
                <td className="px-6 py-4 font-mono text-xs">{dn.date}</td>
                <td className="px-6 py-4 text-sm">{dn.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
