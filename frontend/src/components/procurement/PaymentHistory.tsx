import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { History, Loader2 } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function PaymentHistory() {
  const [payments, setPayments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const b = await inventoryApi.getVendorBills();
      setBills(b || []);

      const res = await inventoryApi.getVendorPayments();
      setPayments(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="text-primary size-6" /> Payment History
          </h2>
          <p className="text-sm text-slate-400">Comprehensive timeline of all vendor settlements.</p>
        </div>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">Payment Date</th>
                <th className="py-4 px-6">Linked Bill No</th>
                <th className="py-4 px-6">Supplier Vendor</th>
                <th className="py-4 px-6 text-right">Amount Paid</th>
                <th className="py-4 px-6">Payment Mode</th>
                <th className="py-4 px-6 text-right">Transaction Ref</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading historical payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground font-semibold">
                    No vendor payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((txn) => {
                  const bill = bills.find((b) => b.id === txn.vendor_bill_id);
                  return (
                    <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs text-muted-foreground">
                        {txn.payment_date ? new Date(txn.payment_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-4 px-6 font-mono text-primary font-semibold">{txn.bill_number || "—"}</td>
                      <td className="py-4 px-6 font-bold">{bill?.supplier_name || "—"}</td>
                      <td className="py-4 px-6 font-bold text-emerald-600 text-right">
                        ₹{txn.amount_paid.toLocaleString("en-IN")}
                      </td>
                      <td className="py-4 px-6 font-semibold">{txn.payment_method}</td>
                      <td className="py-4 px-6 font-mono text-xs text-muted-foreground text-right">{txn.reference_number || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
