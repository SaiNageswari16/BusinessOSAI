import { procurementBills } from "../../data/procurement-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Search, Filter, Receipt, FileText, CheckCircle2, Clock } from "lucide-react";

export function VendorBills() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendor Bills</h2>
          <p className="text-sm text-muted-foreground">Manage supplier invoices linked to POs and GRNs.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Log Bill</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Bill Number</th>
              <th className="px-6 py-4">Linked PO</th>
              <th className="px-6 py-4">Supplier</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Due Date</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {procurementBills.map((bill) => (
              <tr key={bill.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2"><Receipt className="size-4 text-muted-foreground" /> {bill.billNo}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{bill.poNo}</td>
                <td className="px-6 py-4 font-bold">{bill.supplier}</td>
                <td className="px-6 py-4 font-bold">{bill.amount}</td>
                <td className="px-6 py-4 font-mono text-xs">{bill.dueDate}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    bill.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {bill.status === 'Paid' ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                    {bill.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><FileText className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
