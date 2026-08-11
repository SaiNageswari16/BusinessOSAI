import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Receipt, Loader2 } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { ProcurementDocumentForm } from "./ProcurementDocumentForm";

export function VendorBills() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateMode, setIsCreateMode] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getVendorBills();
      setBills(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load vendor bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isCreateMode) {
    return (
      <ProcurementDocumentForm
        docType="PINV"
        onClose={() => setIsCreateMode(false)}
        onSaved={fetchData}
      />
    );
  }

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="text-primary size-6" /> Purchase Invoices & Vendor Bills
          </h2>
          <p className="text-sm text-muted-foreground">Manage supplier purchase invoices linked to POs and GRNs.</p>
        </div>
        <Button onClick={() => setIsCreateMode(true)} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Log Purchase Invoice
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">Bill / Invoice Number</th>
                <th className="py-4 px-6">Linked PO Reference</th>
                <th className="py-4 px-6 text-right font-bold">Invoiced Amount</th>
                <th className="py-4 px-6 text-right">Paid Amount</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading purchase invoices...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No vendor purchase bills logged yet. Click "+ Log Purchase Invoice" above to create one.
                  </td>
                </tr>
              ) : (
                bills.map((b: any) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-primary">{b.bill_number || b.id.slice(0, 8)}</td>
                    <td className="py-4 px-6 font-medium text-foreground">{b.purchase_order_id ? `PO-${b.purchase_order_id.slice(0, 6)}` : "Direct Invoice"}</td>
                    <td className="py-4 px-6 text-right font-bold text-foreground">
                      ₹{b.total_amount?.toLocaleString("en-IN") || 0}
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-emerald-600">
                      ₹{b.paid_amount?.toLocaleString("en-IN") || 0}
                    </td>
                    <td className="py-4 px-6 text-muted-foreground">
                      {b.due_date ? new Date(b.due_date).toLocaleDateString() : "Net 30"}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        b.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                        b.status === 'Partial' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      }`}>
                        {b.status || 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
