import { procurementGRNs } from "../../data/procurement-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Boxes, ArrowDownToLine, Eye } from "lucide-react";

export function GoodsReceivedNotes() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Goods Received Notes (GRN)</h2>
          <p className="text-sm text-muted-foreground">Receive PO stock against inventory automatically.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create GRN</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">GRN Number</th>
              <th className="px-6 py-4">Linked PO</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Received / Damaged</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {procurementGRNs.map((grn) => (
              <tr key={grn.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold flex items-center gap-2"><Boxes className="size-4 text-primary" /> {grn.grnNo}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{grn.poNo}</td>
                <td className="px-6 py-4 font-bold">{grn.supplier}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-emerald-600">{grn.received} Received</div>
                  {grn.damaged > 0 && <div className="text-[10px] text-rose-500 mt-1 font-bold">{grn.damaged} Damaged</div>}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600`}>
                    {grn.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Eye className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
