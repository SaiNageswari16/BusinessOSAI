import { procurementPOs } from "../../data/procurement-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Search, Filter, Truck, Printer, Download, Eye } from "lucide-react";

export function PurchaseOrders() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Purchase Orders (PO)</h2>
          <p className="text-sm text-muted-foreground">Manage official supplier orders, approvals, and dispatch status.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create PO</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">PO Number</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {procurementPOs.map((po) => (
              <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-primary">{po.poNo}</td>
                <td className="px-6 py-4 font-bold flex items-center gap-2"><Truck className="size-4 text-muted-foreground" /> {po.supplier}</td>
                <td className="px-6 py-4 font-mono text-xs">{po.date}</td>
                <td className="px-6 py-4 font-bold">{po.amount}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    po.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : po.status === 'Delivered' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {po.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Eye className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Printer className="size-4" /></Button>
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
