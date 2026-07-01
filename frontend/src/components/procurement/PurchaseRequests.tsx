import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Package, Clock, ShieldCheck, AlignLeft, LayoutGrid } from "lucide-react";

export function PurchaseRequests() {
  const data = [
    { id: 1, prNo: "PR-2026-901", department: "IT & Infrastructure", item: "MacBook Pro 16", qty: 5, date: "2026-07-01", status: "Pending Manager" },
    { id: 2, prNo: "PR-2026-900", department: "Operations", item: "Packaging Tape", qty: 500, date: "2026-06-30", status: "Approved" },
    { id: 3, prNo: "PR-2026-899", department: "Admin", item: "Office Chairs", qty: 15, date: "2026-06-28", status: "PO Generated" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Purchase Requests (PR)</h2>
          <p className="text-sm text-muted-foreground">Manage internal departmental requests for materials and services.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-muted p-1 rounded-lg flex gap-1 mr-4">
            <Button variant="outline" size="icon" className="h-8 w-8 bg-background shadow-sm"><AlignLeft className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><LayoutGrid className="size-4" /></Button>
          </div>
          <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Raise PR</Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">PR Number & Dept</th>
              <th className="px-6 py-4">Requested Item</th>
              <th className="px-6 py-4">Quantity</th>
              <th className="px-6 py-4">Date Raised</th>
              <th className="px-6 py-4">Workflow Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((pr) => (
              <tr key={pr.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-primary font-mono">{pr.prNo}</div>
                  <div className="text-xs text-muted-foreground">{pr.department}</div>
                </td>
                <td className="px-6 py-4 font-bold flex items-center gap-2"><Package className="size-4 text-muted-foreground" /> {pr.item}</td>
                <td className="px-6 py-4 font-mono font-bold">{pr.qty}</td>
                <td className="px-6 py-4 font-mono text-xs">{pr.date}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    pr.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : pr.status === 'PO Generated' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {pr.status === 'Pending Manager' && <Clock className="size-3" />}
                    {pr.status === 'Approved' && <ShieldCheck className="size-3" />}
                    {pr.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="outline" size="sm">Review</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
