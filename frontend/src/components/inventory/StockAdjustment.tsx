import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Sliders, CheckCircle2, XCircle } from "lucide-react";

export function StockAdjustment() {
  const data = [
    { id: 1, date: "2026-07-01", ref: "ADJ-001", reason: "Damage", product: "Apple MacBook Pro 16", qty: "-1", value: "-₹3,49,900", status: "Pending Approval" },
    { id: 2, date: "2026-06-30", ref: "ADJ-002", reason: "Found", product: "Nike Air Force 1", qty: "+2", value: "+₹16,990", status: "Approved" },
    { id: 3, date: "2026-06-28", ref: "ADJ-003", reason: "Expiry", product: "Almond Butter 250g", qty: "-15", value: "-₹3,000", status: "Approved" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Adjustment</h2>
          <p className="text-sm text-muted-foreground">Adjust inventory levels due to damage, loss, or auditing.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Adjustment</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Date & Ref</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Product</th>
              <th className="px-6 py-4">Qty Diff</th>
              <th className="px-6 py-4">Value Impact</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((adj) => (
              <tr key={adj.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-mono text-xs">{adj.date}</div>
                  <div className="font-bold text-xs text-primary">{adj.ref}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="bg-muted px-2 py-1 rounded text-xs font-semibold">{adj.reason}</span>
                </td>
                <td className="px-6 py-4 font-bold">{adj.product}</td>
                <td className="px-6 py-4 font-mono font-bold">{adj.qty}</td>
                <td className="px-6 py-4 font-mono font-medium">{adj.value}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    adj.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {adj.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {adj.status === 'Pending Approval' ? (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500"><CheckCircle2 className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500"><XCircle className="size-4" /></Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm">View</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
